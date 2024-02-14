/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import * as d3 from "d3";

export class LineGraphRenderer {
    private titleGenerator: (index: number) => string;
    private tooltipElement: d3.Selection<SVGGElement, IXYDatum, null, undefined>;

    private xScale: d3.ScaleTime<number, number>; // | d3.ScaleLinear<number, number>;
    private xValues: Array<number | Date>;

    private yScale: d3.ScaleLinear<number, number>;
    private yValues: Array<number | undefined>;

    private colors: d3.ScaleOrdinal<string, string>;

    private tooltip?: ITooltipOptions;
    private data: IXYDatum[];

    private curveMap = new Map<LineGraphCurve, d3.CurveFactory | d3.CurveFactoryLineOnly>([
        ["Basis", d3.curveBasis],
        ["Bundle", d3.curveBundle],
        ["Linear", d3.curveLinear],
        ["Natural", d3.curveNatural],
        ["Step", d3.curveStep],
        ["StepBefore", d3.curveStepBefore],
        ["StepAfter", d3.curveStepAfter],
    ]);

    public constructor() {
        this.colors = d3.scaleOrdinal(d3.schemeCategory10);
    }

    public render(target: SVGSVGElement, config: ILineGraphConfiguration): void {
        if (!config.data) {
            return;
        }

        this.tooltip = config.tooltip;
        this.data = config.data;

        const width = config.transformation?.width ?? 1200;
        const height = config.transformation?.height ?? 900;
        const x = config.transformation?.x ?? "0";
        const y = config.transformation?.y ?? "0";

        const marginTop = config.marginTop ?? 20;
        const marginRight = config.marginRight ?? 30;
        const marginBottom = config.marginBottom ?? 30;
        const marginLeft = config.marginLeft ?? 40;
        const strokeWidth = config.strokeWidth ?? 1.5;
        const strokeLinejoin = config.strokeLinejoin ?? "round";
        const strokeLinecap = config.strokeLinecap ?? "round";

        this.xValues = d3.map(config.data, (datum) => {
            return datum.xValue;
        });

        this.yValues = d3.map(config.data, (datum) => {
            return datum.yValue;
        });

        // Compute which data points are considered defined.
        const isDefined = (_datum: IXYDatum, index: number) => {
            return this.xValues[index] !== undefined && this.yValues[index] !== undefined;
        };

        const definedValues = d3.map(config.data, isDefined);

        // Compute default domains.
        let xDomain = config.xDomain;
        if (!xDomain) {
            const temp = d3.extent(this.xValues);
            if (temp[0] !== undefined && temp[1] !== undefined) {
                if (temp[0] instanceof Date) {
                    xDomain = temp as [Date, Date];
                } else {
                    xDomain = temp as [number, number];
                }
            } else {
                xDomain = [0, 0];
            }
        }

        let yDomain = config.yDomain;
        if (!yDomain) {
            const index = d3.maxIndex(this.yValues);
            yDomain = [0, this.yValues[index] ?? 0];
        }

        // Construct scales and axes.
        // TODO: make the scale types configurable without exposing D3 in the scripting environment.
        const xRange = [marginLeft, width - marginRight];

        // TODO: support a linear x axis too.
        /*if (typeof xDomain[0] === "number") {
            this.xScale = d3.scaleLinear(xDomain, xRange);
        } else {
            this.xScale = d3.scaleUtc(xDomain, xRange);
        }*/
        this.xScale = d3.scaleUtc(xDomain, xRange);
        this.xScale.clamp(true);

        const yRange = [height - marginBottom, marginTop];
        this.yScale = d3.scaleLinear(yDomain, yRange);

        let tickCount = config.xTickCount ?? width / 80;
        const xAxis = d3.axisBottom(this.xScale as d3.AxisScale<Date>).ticks(tickCount).tickSizeOuter(0);
        tickCount = config.yTickCount ?? height / 40;
        const yAxis = d3.axisLeft(this.yScale).ticks(tickCount, config.yFormat);

        if (config.yFormat) {
            if (typeof config.yFormat === "string") {
                yAxis.tickFormat(d3.format(config.yFormat));
            } else {
                yAxis.tickFormat(config.yFormat);
            }
        }

        // Compute titles.
        if (config.xTitle) {
            const objects = d3.map(config.data, (d) => {
                return d;
            });

            this.titleGenerator = (i: number) => {
                return config.xTitle!(objects[i], i, config.data!);
            };

        } else {
            const formatDate = this.xScale.tickFormat(undefined, "%b %-d, %Y");
            const formatValue = this.yScale.tickFormat(undefined, "0.2f");
            this.titleGenerator = (i: number) => {
                const xValue = this.xValues[i];
                if (!this.yValues[i]) {
                    return "";
                }

                if (typeof xValue === "number") {
                    return `${formatValue(xValue)}\n${formatValue(this.yValues[i]!)}`;
                } else {
                    return `${formatDate(xValue)}\n${formatValue(this.yValues[i]!)}`;
                }
            };
        }

        const hostSvg = d3.select<SVGSVGElement, IXYDatum>(target);
        let root;
        try {
            root = hostSvg.select<SVGSVGElement>(`#${config.id}`);
        } catch (reason) {
            root = hostSvg.select<SVGSVGElement>("__invalid__");
        }

        // TODO: instead of completely replacing the graph animate it to the new values.
        root.remove();
        root = hostSvg.append("svg").attr("id", config.id).style("pointer-events", "bounding-box");

        root.on("pointerenter", this.pointerEnter)
            .on("pointermove", this.pointerMoved)
            .on("pointerleave", this.pointerLeft)
            .on("touchstart", (event: MouseEvent) => {
                return event.preventDefault();
            });


        root.attr("x", `${x}`)
            .attr("y", `${y}`)
            .attr("overflow", "visible")
            .attr("width", width)
            .attr("height", height);

        root.append("g")
            .attr("transform", `translate(0,${height - marginBottom})`)
            .attr("id", "xAxis")
            .call(xAxis);

        root.append("g")
            .attr("transform", `translate(${marginLeft},0)`)
            .attr("id", "yAxis")
            .call(yAxis)
            .call((g) => {
                return g.select(".domain").remove();
            })
            .call((g) => {
                return g.selectAll(".tick line").clone()
                    .attr("x2", width - marginLeft - marginRight)
                    .attr("stroke-opacity", 0.1);
            })
            .call((g) => {
                return g.append("text")
                    .attr("x", -marginLeft)
                    .attr("y", 10)
                    .attr("fill", "currentColor")
                    .attr("text-anchor", "start")
                    .text(config.yLabel ?? "");
            });

        const curve = config.curve ? this.curveMap.get(config.curve) ?? d3.curveBasis : d3.curveBasis;
        const lineGenerator = d3.line<number>()
            .defined((i) => {
                return definedValues[i];
            })
            .curve(curve)
            .x((i) => {
                return this.xScale(this.xValues[i]);
            })
            .y((i) => {
                return this.yScale(this.yValues[i] ?? 0);
            });

        const groupValues = d3.map(config.data, (datum) => {
            return datum.group;
        });
        const groupDomain = new d3.InternSet(groupValues);

        // Remove any data which is not presented in a group.
        const filteredData = d3.range(this.xValues.length).filter((i) => {
            return groupDomain.has(groupValues[i]);
        });

        root.append("g")
            .attr("fill", "none")
            .attr("stroke", "currentColor")
            .attr("stroke-width", strokeWidth)
            .attr("stroke-linejoin", strokeLinejoin)
            .attr("stroke-linecap", strokeLinecap)
            .selectAll("path")
            .data(d3.group(filteredData, (i) => {
                return groupValues[i];
            }))
            .join("path")
            .attr("stroke", (datum, index) => {
                return config.colors
                    ? config.colors[index]
                    : this.colors(index.toString());
            })
            .attr("d", ([, indexes]) => {
                return lineGenerator(indexes);
            });

        this.tooltipElement = root.append<SVGGElement>("g")
            .style("pointer-events", "none");
        this.tooltipElement.append("path")
            .attr("fill", "var(--tooltip-background)")
            .attr("stroke", "var(--tooltip-border)")
            .attr("color", "var(--tooltip-foreground");
    }

    private pointerEnter = (event: MouseEvent): void => {
        this.tooltipElement
            .style("display", null)
            .classed("tooltip", true);
        this.pointerMoved(event);
    };

    private pointerMoved = (event: MouseEvent): void => {
        // Temporary cast. Can go once we support numeric x axes.
        const values = this.xValues as Date[];

        const i = d3.bisectCenter(values, this.xScale.invert(d3.pointer(event)[0]));
        const text = this.tooltip ? this.tooltip.format(this.data[i], i, this.data) : this.titleGenerator(i);
        if (!text) {
            this.tooltipElement.style("display", "none");

            return;
        }

        const x = this.tooltip && this.tooltip.position ? this.tooltip.position.left : this.xScale(this.xValues[i]);
        const y = this.tooltip && this.tooltip.position ? this.tooltip.position.top : this.yScale(this.yValues[i] ?? 0);
        this.tooltipElement
            .attr("transform", `translate(${x}, ${y})`)
            .style("display", null);

        const content = `${text}`.split(/\n/);
        const tooltipTextHost = this.tooltipElement.selectAll<SVGTextElement, never>("text")
            .data([0])
            .join("text")
            .call((text) => {
                return text
                    .selectAll("tspan")
                    .data(content)
                    .join("tspan")
                    .style("fill", "var(--tooltip-foreground)")
                    .attr("x", 0)
                    .attr("y", (_, i) => {
                        return i === 0 ? `0` : `${i + 1.01}em`;
                    })
                    .attr("font-weight", (_, i) => { return i ? null : "bold"; })
                    .text((d) => {
                        return d;
                    });
            });

        const node = tooltipTextHost.node();

        // istanbul ignore else
        if (node) {
            const r = node.getBoundingClientRect();
            r.width += 20;
            r.x -= 10;

            tooltipTextHost.attr("transform", `translate(${-r.width / 2},${25})`);

            const path = this.tooltipElement.selectAll("path");
            if (this.tooltip?.position) {
                // Draw a simple rectangle for absolute coordinates.
                path.attr("d", `M${-r.width / 2 - 10},5H${r.width / 2 + 10}v` +
                    `${r.height + 30}h-${r.width + 20}z`);
            } else {
                path.attr("d", `M${-r.width / 2 - 10},5H-5l5,-5l5,5H${r.width / 2 + 10}` +
                    `v${r.height + 30}h-${r.width + 20}z`);
            }
        }
    };

    private pointerLeft = (): void => {
        this.tooltipElement.style("display", "none");
    };
}
