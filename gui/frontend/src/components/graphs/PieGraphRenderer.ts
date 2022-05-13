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

type PieChartSelection = d3.Selection<SVGGElement, IPieDatum, null, undefined>;

// We need a number of enhanced SVG element interfaces to store previous data for animations.

interface IPieGeometryElement extends SVGGeometryElement {
    previous: IPieDatum;
}

interface IPieTextElement extends SVGTextElement {
    previous: IPieDatum;
}

interface IPiePathElement extends SVGPathElement {
    previous: IPieDatum;
}

interface IPiePolylineElement extends SVGPolylineElement {
    previous: IPieDatum;
}

export class PieGraphRenderer {
    private pieGenerator = d3.pie<IPieDatum>().value((point) => {
        return point.value;
    }).sort(null);

    private colors: d3.ScaleOrdinal<string, string>;
    private format: (n: number) => string;

    public constructor() {
        this.colors = d3.scaleOrdinal(d3.schemeCategory10);
        this.format = d3.format(".2f");
    }

    public render(target: SVGElement, entry: IPieGraphConfiguration, index: number): void {
        if (!entry.data) {
            return;
        }

        const rootId = entry.id ?? `pieChart${index}`;

        const svg = d3.select<SVGElement, IPieDatum>(target);
        let root = svg.select<SVGGElement>(`#${rootId}`);

        let slices: PieChartSelection;
        let labels: PieChartSelection;
        let lines: PieChartSelection;
        if (root.empty()) {
            root = svg.append("g").attr("id", rootId).style("transform", "translate(50%, 50%)");
            slices = root.append<SVGGElement>("g").attr("class", "slices");
            labels = root.append("g").attr("class", "labels");
            lines = root.append("g").attr("class", "lines");
        } else {
            slices = root.select<SVGGElement>(".slices");
            labels = root.select(".labels");
            lines = root.select(".lines");
        }

        // Note: this is all user supplied data from the scripting interface, so do proper sanity checks.
        const data = entry.data.length <= 100 ? entry.data : entry.data.slice(0, 100);

        const pieData = this.pieGenerator(data);

        const key = (node: d3.PieArcDatum<IPieDatum>): string => {
            return node.data.name ?? "";
        };

        const innerRadius = entry.radius?.[0] ?? 0;
        const outerRadius = entry.radius?.[1] ?? 300;
        const sliceArcGenerator = d3
            .arc<d3.PieArcDatum<IPieDatum>>()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        if (entry.borderRadius !== undefined) {
            sliceArcGenerator.cornerRadius(entry.borderRadius);
        }

        if (entry.startAngle !== undefined) {
            sliceArcGenerator.startAngle(entry.startAngle);
        }

        if (entry.endAngle !== undefined) {
            sliceArcGenerator.endAngle(entry.endAngle);
        }

        if (entry.padAngle !== undefined) {
            sliceArcGenerator.padAngle(entry.padAngle);
        }

        if (entry.padRadius !== undefined) {
            sliceArcGenerator.padRadius(entry.padRadius);
        }

        const textArcGenerator = d3
            .arc<d3.PieArcDatum<IPieDatum>>()
            .innerRadius(outerRadius * 0.75)
            .outerRadius(outerRadius * 1.5);

        // Pie slices.
        const slice = slices.selectAll<IPieGeometryElement, d3.PieArcDatum<IPieDatum>>("path.slice")
            .data(pieData, key);

        const path = slice.enter()
            .insert<IPiePathElement>("path")
            .style("fill", (datum, index) => {
                return entry.colors
                    ? entry.colors[index]
                    : this.colors(datum.data.name ?? index.toString());
            })
            .attr("class", "slice")
            .attr("d", (datum, index, group) => {
                const element = group[index];
                element.previous = datum;

                return sliceArcGenerator(datum);
            });

        if (entry.borderWidth !== undefined) {
            path.style("stroke-width", entry.borderWidth);
        }

        if (entry.borderColor !== undefined) {
            path.style("stroke", entry.borderColor);
        }

        /* istanbul ignore next */
        slice.transition().duration(500)
            .attrTween("d", (datum, index, group) => {
                const element = group[index];
                const interpolate = d3.interpolate(element.previous, datum);
                element.previous = interpolate(0);

                return (t: number): string => {
                    return sliceArcGenerator(interpolate(t)) ?? "";
                };
            });

        slice.exit().remove();

        // Text labels.
        const textOffset = outerRadius + 30;
        const midAngle = (d: d3.PieArcDatum<IPieDatum>): number => {
            return d.startAngle + (d.endAngle - d.startAngle) / 2;
        };

        const label = labels
            .selectAll<IPieGeometryElement, d3.PieArcDatum<IPieDatum>>("text")
            .data(pieData, key);

        label.enter()
            .append<IPieTextElement>("text")
            .attr("dy", ".35em")
            .text((d) => {
                return d.data.name ?? this.format(d.data.value);
            })
            .attr("transform", (datum, index, group) => {
                const element = group[index];
                element.previous = datum;

                const pos = textArcGenerator.centroid(datum);
                pos[0] = textOffset * (midAngle(datum) < Math.PI ? 1 : -1);

                return `translate(${pos[0]},${pos[1]})`;
            })
            .attr("text-anchor", (datum, index, group) => {
                const element = group[index];
                element.previous = datum;

                return midAngle(datum) < Math.PI ? "start" : "end";
            });

        // Testing note: animations cannot be played with mock DOM.
        /* istanbul ignore next */
        label.transition().duration(500)
            .attrTween("transform", (datum, index, group) => {
                const element = group[index];
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
                const element = group[index];
                const interpolate = d3.interpolate(element.previous, datum);
                element.previous = interpolate(0);

                return (t): string => {
                    const d2 = interpolate(t);

                    return midAngle(d2) < Math.PI ? "start" : "end";
                };
            });

        label.exit().remove();

        // Slice to text poly lines.
        const polyline = lines
            .selectAll<IPieGeometryElement, d3.PieArcDatum<IPieDatum>>("polyline")
            .data(pieData, key);

        polyline.enter()
            .append<IPiePolylineElement>("polyline")
            .attr("points", (datum, index, group) => {
                const element = group[index];
                element.previous = datum;

                const pos = textArcGenerator.centroid(datum);
                const x = textOffset * 0.95 * (midAngle(datum) < Math.PI ? 1 : -1);

                return [sliceArcGenerator.centroid(datum), pos, [x, pos[1]]].toString();
            });

        /* istanbul ignore next */
        polyline.transition().duration(500)
            .attrTween("points", (datum, index, group) => {
                const element = group[index];
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
    }

}
