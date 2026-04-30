/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";

import { ComponentBase, IComponentProperties, IComponentState } from "../ui/Component/ComponentBase.js";

import { BarGraphRenderer } from "./BarGraphRenderer.js";
import { LineGraphRenderer } from "./LineGraphRenderer.js";
import { PieGraphRenderer } from "./PieGraphRenderer.js";

interface IGraphHostProps extends IComponentProperties {
    options: IGraphOptions;
}

interface IGraphHostState extends IComponentState {
    width: number;
    height: number;
}

// This is the actual component to render a Pie graph.
export class GraphHost extends ComponentBase<IGraphHostProps, IGraphHostState> {

    private svgRef = createRef<SVGSVGElement>();
    private resizeObserver?: ResizeObserver;
    private observedSvg?: SVGSVGElement;

    public constructor(props: IGraphHostProps) {
        super(props);

        this.state = {
            width: 0,
            height: 0,
        };

        this.addHandledProperties("options");
    }

    public override componentDidMount(): void {
        this.startResizeObserver();
        this.update();
    }

    public override componentDidUpdate(): void {
        this.startResizeObserver();
        this.update();
    }

    public override componentWillUnmount(): void {
        this.resizeObserver?.disconnect();
        this.observedSvg = undefined;
    }

    public render(): ComponentChild {
        const { id, options } = this.props;

        const className = this.getEffectiveClassNames(["graphHost"]);
        const { left, top, width, height } = this.viewport();

        return (
            <svg
                ref={this.svgRef}
                id={id}
                className={className}
                viewBox={`${left} ${top} ${width} ${height}`}
                preserveAspectRatio={options.preserveAspectRatio ?? "xMidYMid"}
            />
        );
    }

    private update = (): void => {
        const options = this.graphOptions();

        // istanbul ignore else
        if (this.svgRef.current) {
            // Remove previously rendered graphs which are not in the current configuration.
            const existing = this.svgRef.current.getElementsByTagName("svg");

            for (let i = 0; i < existing.length; ++i) {
                const element = existing.item(i);
                if (element?.id) {
                    const index = options.series?.findIndex((candidate) => {
                        return candidate.id === element.id;
                    }) ?? -1;

                    if (index === -1) {
                        this.svgRef.current.removeChild(element);
                    }
                }
            }

            options.series?.forEach((entry) => {
                switch (entry.type) {
                    case "pie": {
                        const renderer = new PieGraphRenderer();
                        entry.colors ??= options.colors;
                        renderer.render(this.svgRef.current!, entry);

                        break;
                    }

                    case "line": {
                        const renderer = new LineGraphRenderer();
                        entry.colors ??= options.colors;
                        renderer.render(this.svgRef.current!, entry);

                        break;
                    }

                    case "bar": {
                        const renderer = new BarGraphRenderer();
                        entry.colors ??= options.colors;
                        renderer.render(this.svgRef.current!, entry);

                        break;
                    }

                    // istanbul ignore next
                    default:
                }
            });
        }
    };

    private startResizeObserver(): void {
        const svg = this.svgRef.current;
        if (!this.props.options.resizeToHost || !svg) {
            this.resizeObserver?.disconnect();
            this.resizeObserver = undefined;
            this.observedSvg = undefined;

            return;
        }

        if (this.observedSvg === svg) {
            return;
        }

        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.observedSvg = svg;

        const updateSize = (): void => {
            const rect = svg.getBoundingClientRect();
            const width = Math.floor(rect.width);
            const height = Math.floor(rect.height);

            if (width <= 0 || height <= 0) {
                return;
            }

            if (width !== this.state.width || height !== this.state.height) {
                this.setState({ width, height });
            }
        };

        updateSize();

        /* istanbul ignore next */
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(updateSize);
            this.resizeObserver.observe(svg);
        }
    }

    private viewport(): { left: number; top: number; width: number; height: number } {
        const { options } = this.props;
        const left = options.viewport?.left ?? 0;
        const top = options.viewport?.top ?? 0;
        const defaultWidth = options.viewport?.width ?? 1200;
        const defaultHeight = options.viewport?.height ?? 900;

        if (!options.resizeToHost || this.state.width <= 0 || this.state.height <= 0) {
            return {
                left,
                top,
                width: defaultWidth,
                height: defaultHeight,
            };
        }

        return {
            left,
            top,
            width: this.state.width,
            height: this.state.height,
        };
    }

    private graphOptions(): IGraphOptions {
        const { options } = this.props;
        if (!options.resizeToHost) {
            return options;
        }

        const viewport = this.viewport();

        return {
            ...options,
            viewport,
            series: options.series?.map((entry) => {
                if (!entry.transformation) {
                    return entry;
                }

                return {
                    ...entry,
                    transformation: {
                        ...entry.transformation,
                        width: viewport.width,
                        height: viewport.height,
                    },
                };
            }),
        };
    }
}
