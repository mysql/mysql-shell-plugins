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

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react";
import * as d3 from "d3";

import { Component, IComponentProperties } from "../../ui";

export interface IPieGraphDataPoint {
    /** The label to show for this data point. If no label is given then the value is printed instead. */
    label?: string;

    value: number;

    /**
     * An optional color to use for this pie piece (specified as HTML color).
     *  If not given then a default one is used instead.
     */
    color?: string;
}

export interface IResultSetRow {
    [key: string]: unknown;
}

export interface IPieGraphLayout {
    /** The width of the root svg group element. */
    width?: number;

    /** The height of the root svg group element. */
    height?: number;

    /** The inner radius of the pie chart. Values > 0 create a donut graphic. */
    innerRadius?: number;

    /** The outer radius of the pie chart. Determines the overall size and must be > the inner radius. */
    outerRadius?: number;

    /** The horizontal position where to place the center of the pie chart. */
    centerX?: number;

    /** The vertical position where to place the center of the pie chart. */
    centerY?: number;
}

export interface IPieLayoutData {
    mediumPie: IPieGraphLayout;
    mediumDonut: IPieGraphLayout;
    largePie: IPieGraphLayout;
    largeDonut: IPieGraphLayout;
}

export interface IPieDemoData {
    budget: IPieGraphDataPoint[];
    spending: IPieGraphDataPoint[];
}

export interface IPieGraphImplProps extends IComponentProperties {
    innerRadius?: number;
    outerRadius?: number;

    width?: number;
    height?: number;

    centerX?: number;
    centerY?: number;

    pointData?: IPieGraphDataPoint[];
}

// This is the actual component to render a Pie graph.
export class PieGraphImpl extends Component<IPieGraphImplProps> {

    private svgRef = React.createRef<SVGSVGElement>();

    private pieGenerator = d3.pie<IPieGraphDataPoint>().value((point) => {
        return point.value;
    }).sort(null);

    private colors: d3.ScaleOrdinal<string, string>;
    private format: (n: number) => string;

    public constructor(props: IPieGraphImplProps) {
        super(props);

        this.addHandledProperties("innerRadius", "outerRadius", "width", "height", "centerX", "centerY", "pointData");

        this.colors = d3.scaleOrdinal(d3.schemeCategory10);
        this.format = d3.format(".2f");
    }

    public componentDidMount(): void {
        const { width = 100, height = 100 } = this.props;

        const svg = d3.select(this.svgRef.current).append("g");

        svg
            .attr("width", width)
            .attr("height", height);

        svg.append("g")
            .attr("class", "slices");
        svg.append("g")
            .attr("class", "labels");
        svg.append("g")
            .attr("class", "lines");

        this.change();
    }

    public componentDidUpdate(): void {
        this.change();
    }

    public render(): React.ReactNode {
        const className = this.getEffectiveClassNames(["pieChart"]);

        return (
            <svg
                ref={this.svgRef}
                className={className}
            />
        );
    }

    private change = (): void => {
        /* istanbul ignore next */
        if (!this.svgRef.current) {
            return;
        }

        // Note: this is all user supplied data from the scripting interface, so do proper sanity checks.
        let {
            pointData: data = [],
            innerRadius = 0,
            outerRadius = 200,
            centerX = 100,
            centerY = 100,
        } = this.props;

        if (data.length > 100) {
            data = data.slice(0, 100);
        }

        if (isNaN(innerRadius) || !isFinite(innerRadius) || innerRadius < 0) {
            innerRadius = 0;
        }

        if (isNaN(outerRadius) || !isFinite(outerRadius) || outerRadius < 0) {
            outerRadius = 0;
        }

        if (innerRadius > outerRadius) {
            const temp = innerRadius;
            innerRadius = outerRadius;
            outerRadius = temp;
        }

        if (isNaN(centerX) || !isFinite(centerX)) {
            centerX = 100;
        }

        if (isNaN(centerY) || !isFinite(centerY)) {
            centerY = 100;
        }

        const pieData = this.pieGenerator(data);

        const svg = d3.select<SVGSVGElement, IPieGraphDataPoint>(this.svgRef.current);
        svg.select(":first-child")
            .attr("transform", `translate(${centerX},${centerY})`);

        const key = (node: d3.PieArcDatum<IPieGraphDataPoint>): string => {
            return node.data.label as string;
        };

        const sliceArcGenerator = d3
            .arc<d3.PieArcDatum<IPieGraphDataPoint>>()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        const textArcGenerator = d3
            .arc<d3.PieArcDatum<IPieGraphDataPoint>>()
            .innerRadius(outerRadius * 0.75)
            .outerRadius(outerRadius * 1.5);

        // Pie slices.
        const slice = svg.select(".slices")
            .selectAll<SVGGeometryElement, d3.PieArcDatum<IPieGraphDataPoint>>("path.slice")
            .data(pieData, key);

        slice.enter()
            .insert("path")
            .style("fill", (datum, index) => {
                return datum.data.color
                    ? datum.data.color
                    : this.colors(datum.data.label ?? index.toString());
            },
            )
            .attr("class", "slice")
            .attr("d", (datum, index, group) => {
                const element: any = group[index];
                element.previous = datum;

                return sliceArcGenerator(datum);
            });

        /* istanbul ignore next */
        slice.transition().duration(1000)
            .attrTween("d", (datum, index, group): any => {
                const element: any = group[index];
                const interpolate = d3.interpolate(element.previous, datum);
                element.previous = interpolate(0);

                return (t: number): any => { return sliceArcGenerator(interpolate(t)); };
            });

        slice.exit().remove();

        // Text labels.
        const textOffset = outerRadius + 30;
        const midAngle = (d: d3.PieArcDatum<IPieGraphDataPoint>): number => {
            return d.startAngle + (d.endAngle - d.startAngle) / 2;
        };

        const text = svg.select(".labels")
            .selectAll<SVGGeometryElement, d3.PieArcDatum<IPieGraphDataPoint>>("text")
            .data(pieData, key);

        text.enter()
            .append("text")
            .attr("dy", ".35em")
            .text((d) => { return d.data.label ?? this.format(d.data.value); })
            .attr("transform", (datum, index, group) => {
                const element: any = group[index];
                element.previous = datum;

                const pos = textArcGenerator.centroid(datum);
                pos[0] = textOffset * (midAngle(datum) < Math.PI ? 1 : -1);

                return `translate(${pos[0]},${pos[1]})`;
            })
            .attr("text-anchor", (datum, index, group) => {
                const element: any = group[index];
                element.previous = datum;

                return midAngle(datum) < Math.PI ? "start" : "end";
            });

        // Testing note: animations cannot be played with mock DOM.
        /* istanbul ignore next */
        text.transition().duration(1000)
            .attrTween("transform", (datum, index, group) => {
                const element: any = group[index];
                const interpolate = d3.interpolate(element.previous, datum);
                element.previous = interpolate(0);

                return (t): string => {
                    const d2 = interpolate(t);
                    const pos = textArcGenerator.centroid(d2);
                    pos[0] = textOffset * (midAngle(d2) < Math.PI ? 1 : -1);

                    return `translate(${pos[0]},${pos[1]})`;
                };
            })
            .styleTween("text-anchor", (datum, index, group) => {
                const element: any = group[index];
                const interpolate = d3.interpolate(element.previous, datum);
                element.previous = interpolate(0);

                return (t): string => {
                    const d2 = interpolate(t);

                    return midAngle(d2) < Math.PI ? "start" : "end";
                };
            });

        text.exit().remove();

        // Slice to text poly lines.
        const polyline = svg.select(".lines")
            .selectAll<SVGGeometryElement, d3.PieArcDatum<IPieGraphDataPoint>>("polyline")
            .data(pieData, key);

        polyline.enter()
            .append("polyline")
            .attr("points", (datum, index, group) => {
                const element: any = group[index];
                element.previous = datum;

                const pos = textArcGenerator.centroid(datum);
                const x = textOffset * 0.95 * (midAngle(datum) < Math.PI ? 1 : -1);

                return [sliceArcGenerator.centroid(datum), pos, [x, pos[1]]].toString();
            });

        /* istanbul ignore next */
        polyline.transition().duration(1000)
            .attrTween("points", (datum, index, group) => {
                const element: any = group[index];
                const interpolate = d3.interpolate(element.previous, datum);
                element.previous = interpolate(0);

                return (t): string => {
                    const d2 = interpolate(t);
                    const pos = textArcGenerator.centroid(d2);
                    const x = textOffset * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);

                    return [sliceArcGenerator.centroid(d2), pos, [x, pos[1]]].toString();
                };
            });

        polyline.exit().remove();
    };

}
