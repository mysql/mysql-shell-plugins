/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import * as d3 from "d3";
import { AxisScale } from "d3";

export class LineGraphRenderer {
    // TODO: find a way to determine these values from the size of the container.
    private width: number;
    private height: number;

    private titleGenerator: (index: number) => string;
    private tooltip: d3.Selection<SVGGElement, IXYDatum, null, undefined>;

    private xScale: d3.ScaleTime<number, number>; // | d3.ScaleLinear<number, number>;
    private xValues: Array<number | Date>;

    private yScale: d3.ScaleLinear<number, number>;
    private yValues: number[];

    public constructor() {
        this.width = 800;
        this.height = 600;
    }

    public render(target: SVGElement, entry: ILineGraphConfiguration, index: number): void {
        if (!entry.data) {
            return;
        }

        // Set defaults first.
        const marginTop = entry.marginTop ?? 20;
        const marginRight = entry.marginRight ?? 30;
        const marginBottom = entry.marginBottom ?? 30;
        const marginLeft = entry.marginLeft ?? 40;
        const strokeColor = entry.strokeColor ?? "currentColor";
        const strokeWidth = entry.strokeWidth ?? 1.5;
        const strokeLinejoin = entry.strokeLinejoin ?? "round";
        const strokeLinecap = entry.strokeLinecap ?? "round";

        this.xValues = d3.map(entry.data, (datum) => {
            return datum.xValue;
        });

        this.yValues = d3.map(entry.data, (datum) => {
            return datum.yValue;
        });

        // Compute which data points are considered defined.
        const isDefined = (_datum: IXYDatum, index: number) => {
            return this.xValues[index] !== undefined && this.yValues[index] !== undefined;
        };

        const definedValues = d3.map(entry.data, isDefined);

        // Compute default domains.
        let xDomain = entry.xDomain;
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

        let yDomain: [number, number] | undefined = entry.yDomain;
        if (!yDomain) {
            yDomain = [0, d3.max(this.yValues) ?? 0];
        }

        // Construct scales and axes.
        // TODO: make the scale types configurable without exposing D3 in the scripting environment.
        const xRange = [marginLeft, this.width - marginRight];

        // TODO: support a linear x axis too.
        /*if (typeof xDomain[0] === "number") {
            this.xScale = d3.scaleLinear(xDomain, xRange);
        } else {
            this.xScale = d3.scaleUtc(xDomain, xRange);
        }*/
        this.xScale = d3.scaleUtc(xDomain, xRange);

        const yRange = [this.height - marginBottom, marginTop];
        this.yScale = d3.scaleLinear(yDomain, yRange);

        const xAxis = d3.axisBottom(this.xScale as AxisScale<Date>).ticks(this.width / 80).tickSizeOuter(0);
        const yAxis = d3.axisLeft(this.yScale).ticks(this.height / 40, entry.yFormat);

        // Compute titles.
        if (entry.xTitle) {
            const objects = d3.map(entry.data, (d) => {
                return d;
            });

            this.titleGenerator = (i: number) => {
                return entry.xTitle!(objects[i], i, entry.data!);
            };

        } else {
            const formatDate = this.xScale.tickFormat(undefined, "%b %-d, %Y");
            const formatValue = this.yScale.tickFormat(100, entry.yFormat);
            this.titleGenerator = (i: number) => {
                const xValue = this.xValues[i];
                if (typeof xValue === "number") {
                    return `${formatValue(xValue)}\n${formatValue(this.yValues[i])}`;
                } else {
                    return `${formatDate(xValue)}\n${formatValue(this.yValues[i])}`;
                }
            };
        }

        // Construct a line generator.
        // TODO: make the curve type configurable without exposing D3 in the scripting environment.
        const lineGenerator = d3.line<number>()
            .defined((i) => {
                return definedValues[i];
            })
            .curve(d3.curveLinear)
            .x((i) => {
                return this.xScale(this.xValues[i]);
            })
            .y((i) => {
                return this.yScale(this.yValues[i]);
            });

        const svg = d3.select<SVGElement, IXYDatum>(target);
        svg
            .on("pointerenter pointermove", this.pointerMoved)
            .on("pointerleave", this.pointerLeft)
            .on("touchstart", (event: MouseEvent) => {
                return event.preventDefault();
            });

        const rootId = entry.id ?? `lineChart${index}`;
        let root = svg.select<SVGGElement>(`#${rootId}`);

        // TODO: instead of completely replacing the graph animate it to the new values.
        root.remove();

        root = svg.append("g").attr("id", rootId);

        const xAxisPath = root.select("#xAxis");
        if (xAxisPath.empty()) {
            root.append("g")
                .attr("transform", `translate(0,${this.height - marginBottom})`)
                .attr("id", "xAxis")
                .call(xAxis);
        }

        root.append("g")
            .attr("transform", `translate(${marginLeft},0)`)
            .attr("id", "yAxis")
            .call(yAxis)
            .call((g) => {
                return g.select(".domain").remove();
            })
            .call((g) => {
                return g.selectAll(".tick line").clone()
                    .attr("x2", this.width - marginLeft - marginRight)
                    .attr("stroke-opacity", 0.1);
            })
            .call((g) => {
                return g.append("text")
                    .attr("x", -marginLeft)
                    .attr("y", 10)
                    .attr("fill", "currentColor")
                    .attr("text-anchor", "start")
                    .text(entry.yLabel ?? "");
            });

        const indexes = d3.map(entry.data, (_, i) => {
            return i;
        });

        root.append("path")
            .attr("fill", "none")
            .attr("stroke", strokeColor)
            .attr("stroke-width", strokeWidth)
            .attr("stroke-linejoin", strokeLinejoin)
            .attr("stroke-linecap", strokeLinecap)
            .attr("d", lineGenerator(indexes));

        this.tooltip = root.append<SVGGElement>("g")
            .style("pointer-events", "none");
    }

    private pointerMoved = (event: MouseEvent): void => {
        // Temporary cast. Can go once we support numeric x axes.
        const values = this.xValues as Date[];

        const i = d3.bisectCenter(values, this.xScale.invert(d3.pointer(event)[0]));
        this.tooltip.style("display", null);
        this.tooltip.attr("transform", `translate(${this.xScale(this.xValues[i])},${this.yScale(this.yValues[i])})`);

        const path = this.tooltip.selectAll("path")
            .data([0, 0])
            .join("path")
            .attr("fill", "white")
            .attr("stroke", "black");

        const text = this.tooltip.selectAll<SVGTextElement, never>("text")
            .data([0, 0])
            .join("text")
            .call((text) => {
                return text
                    .selectAll("tspan")
                    .data(`${this.titleGenerator(i)}`.split(/\n/))
                    .join("tspan")
                    .attr("x", 0)
                    .attr("y", (_, i) => { return `${i * 1.1}em`; })
                    .attr("font-weight", (_, i) => { return i ? null : "bold"; })
                    .text((d) => { return d; });
            });

        const node = text.node();

        // istanbul ignore else
        if (node) {
            const r = node.getBoundingClientRect();

            text.attr("transform", `translate(${-r.width / 2},${15 - r.top})`);
            path.attr("d", `M${-r.width / 2 - 10},5H-5l5,-5l5,5H${r.width / 2 + 10}v` +
                `${r.height + 20}h-${r.width + 20}z`);
        }
    };

    private pointerLeft = (): void => {
        this.tooltip.style("display", "none");
    };
}
