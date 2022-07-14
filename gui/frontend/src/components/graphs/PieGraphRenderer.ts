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
    private format: (n: number) => string;

    public constructor() {
        this.format = d3.format(".2f");
    }

    public render(target: SVGSVGElement, config: IPieGraphConfiguration): void {
        if (!config.data) {
            return;
        }

        const width = config.transformation?.width ?? 1200;
        const height = config.transformation?.height ?? 900;
        const x = config.transformation?.x ?? "50%";
        const y = config.transformation?.y ?? "50%";

        const innerRadius = config.radius?.[0] ?? 0;
        const outerRadius = config.radius?.[1] ?? 450;

        const hostSvg = d3.select<SVGElement, IPieDatum>(target);
        let sliceGroup: PieChartSelection;
        let labels: PieChartSelection;
        let lines: PieChartSelection;

        let svg = hostSvg.select<SVGSVGElement>(`#${config.id}`);
        if (svg.empty()) {
            svg = hostSvg.append("svg").attr("id", config.id);

            const root = svg.append("g");
            sliceGroup = root.append<SVGGElement>("g").attr("class", "slices");
            labels = root.append("g").attr("class", "labels");
            lines = root.append("g").attr("class", "lines");
        } else {
            const root = svg.select<SVGGElement>("g");
            sliceGroup = root.select<SVGGElement>(".slices");
            labels = root.select(".labels");
            lines = root.select(".lines");
        }

        svg
            .attr("x", `${x}`).attr("y", `${y}`)
            .attr("overflow", "visible")
            .attr("viewBox", `0 0 ${width} ${height}`);

        // Note: this is all user supplied data from the scripting interface, so do proper sanity checks.
        const data = config.data.length <= 100 ? config.data : config.data.slice(0, 100);

        const pieGenerator = d3.pie<IPieDatum>().value((point) => {
            return point.value;
        }).sort(null);

        const pieData = pieGenerator(data);

        const key = (node: d3.PieArcDatum<IPieDatum>): string => {
            return node.data.name ?? "";
        };

        const sliceArcGenerator = d3
            .arc<d3.PieArcDatum<IPieDatum>>()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        if (config.borderRadius !== undefined) {
            sliceArcGenerator.cornerRadius(config.borderRadius);
        }

        if (config.startAngle !== undefined) {
            sliceArcGenerator.startAngle(config.startAngle);
        }

        if (config.endAngle !== undefined) {
            sliceArcGenerator.endAngle(config.endAngle);
        }

        if (config.padAngle !== undefined) {
            sliceArcGenerator.padAngle(config.padAngle);
        }

        if (config.padRadius !== undefined) {
            sliceArcGenerator.padRadius(config.padRadius);
        }

        // Pie slices.
        const slicePaths = sliceGroup.selectAll<IPieGeometryElement, d3.PieArcDatum<IPieDatum>>("path").data(pieData);

        const path = slicePaths.enter()
            .insert<IPiePathElement>("path")
            .attr("class", "slice")
            .style("fill", (_, index) => {
                return config.colors ? config.colors[index] : d3.schemeCategory10[index % 10];
            })
            .attr("d", (datum, index, group) => {
                const element = group[index];
                element.previous = datum;

                return sliceArcGenerator(datum);
            })
            .on("mouseover", function (event, datum) {
                if (config.tooltip) {
                    const text = config.tooltip.format(datum.data);
                    this.setAttribute("data-tooltip", text);

                    return;
                }

                let text = "";
                if (datum.data.name) {
                    text = `${datum.data.name}: `;
                }

                if (Number.isInteger(datum.data.value)) {
                    text += `${datum.data.value.toLocaleString()}`;
                } else {
                    text += `${datum.data.value.toFixed(2)}`;
                }
                this.setAttribute("data-tooltip", text);
            });

        if (config.borderWidth !== undefined) {
            path.style("stroke-width", config.borderWidth);
        }

        if (config.borderColor !== undefined) {
            path.style("stroke", config.borderColor);
        }

        /* istanbul ignore next */
        slicePaths.transition().duration(500)
            .attrTween("d", (datum, index, group) => {
                const element = group[index];
                const interpolate = d3.interpolate(element.previous, datum);
                element.previous = interpolate(0);

                return (t: number): string => {
                    return sliceArcGenerator(interpolate(t)) ?? "";
                };
            })
            .ease(d3.easeCubicOut);

        slicePaths.exit().remove();

        // Text labels.
        if (config.showValues ?? true) {
            const textArcGenerator = d3
                .arc<d3.PieArcDatum<IPieDatum>>()
                .innerRadius(outerRadius * 0.75)
                .outerRadius(outerRadius * 1.5);

            const textOffset = outerRadius + 30;
            const midAngle = (d: d3.PieArcDatum<IPieDatum>): number => {
                return d.startAngle + (d.endAngle - d.startAngle) / 2;
            };

            const label = labels
                .selectAll<IPieGeometryElement, d3.PieArcDatum<IPieDatum>>("text")
                .data(pieData, key);

            label.enter()
                .append<IPieTextElement>("text")
                .attr("fill", "currentColor")
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

}
