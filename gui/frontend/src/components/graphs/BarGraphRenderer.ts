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

export class BarGraphRenderer {
    // TODO: find a way to determine these values from the size of the container.
    private width: number;
    private height: number;

    private colors: d3.ScaleOrdinal<string, string>;

    private readonly dateFormatOptions: Intl.DateTimeFormatOptions = {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
    };

    public constructor() {
        this.colors = d3.scaleOrdinal(d3.schemeCategory10);

        this.width = 800;
        this.height = 600;
    }

    public render(target: SVGElement, entry: IBarGraphConfiguration, index: number): void {
        if (!entry.data) {
            return;
        }

        // Set defaults first.
        const marginTop = entry.marginTop ?? 20;
        const marginRight = entry.marginRight ?? 30;
        const marginBottom = entry.marginBottom ?? 30;
        const marginLeft = entry.marginLeft ?? 40;
        const xPadding = entry.xPadding ?? 0.1;

        const rootId = entry.id ?? `barChart${index}`;

        const svg = d3.select<SVGElement, DatumDataType>(target);
        let root = svg.select<SVGElement>(`#${rootId}`);

        let firstRun = false;
        if (root.empty()) {
            firstRun = true;
            root = svg.append<SVGElement>("g").attr("id", rootId);
        }

        let xValues: DatumDataType[] = [];
        let yValues: DatumDataType[] = [];

        const descriptions: string[] = [];

        // The possible type of the ordinate values. If no data is available or the type cannot be determine
        //  "string" ist used.
        let yDataType = "string";

        if (entry.data.length > 0) {
            if (this.isTabularData(entry.data)) {
                xValues = d3.map(entry.data, (datum) => {
                    return datum[0];
                });

                // Remove the first row, which contains the category descriptions.
                xValues.shift();

                yValues = d3.map(entry.data, (datum) => {
                    return datum[1];
                });

                // Copy over the first value, which serves as description of the data (e.g. for tooltips).
                descriptions.push(String(yValues.shift()));

                if (yValues.length > 0) {
                    yDataType = typeof yValues[0];
                }
            } else {
                // Derive x and y key names from the first entry.
                const first = entry.data[0];
                const keys = Object.keys(first);

                const xKey = keys.length > 0 ? keys[0] : "";
                const yKey = keys.length > 1 ? keys[1] : "";

                xValues = d3.map(entry.data, (datum) => {
                    return datum[xKey];
                });

                yValues = d3.map(entry.data, (datum) => {
                    return datum[yKey];
                });

                if (yValues.length > 0) {
                    yDataType = typeof yValues[0];
                }
            }
        }

        // Compute default domains, and unique the x-domain.
        let yDomain = entry.yDomain;
        if (!yDomain) {
            const maxIndex = d3.maxIndex(yValues, (datum) => {
                return datum;
            });

            const minIndex = d3.minIndex(yValues, (datum) => {
                return datum;
            });

            yDomain = [
                minIndex === -1 ? yValues[0] : yValues[minIndex],
                maxIndex === -1 ? yValues[yValues.length - 1] : yValues[maxIndex]];
        }

        const xDomainSet = new d3.InternSet(entry.xDomain ?? xValues);

        // Omit any data not present in the x-domain.
        const dataIndexes = d3.range(xValues.length).filter((i) => {
            return xDomainSet.has(xValues[i]);
        });

        // Construct scales, axes, and formats.
        // TODO: make the scale types configurable without exposing D3 in the scripting environment.
        const xRange = [marginLeft, this.width - marginRight];
        const xScaleBand = d3.scaleBand(xDomainSet, xRange).padding(xPadding);
        const xAxis = d3.axisBottom(xScaleBand);
        xAxis.tickFormat((value) => {
            if (typeof value === "object") {
                // Must be a date.
                return value.toLocaleDateString(undefined, this.dateFormatOptions);
            } else {
                return String(value);
            }
        });

        const yRange = [this.height - marginBottom, marginTop];

        const colorGenerator = (_datum: unknown, index: number) => {
            return entry.colors
                ? entry.colors[index]
                : this.colors(index.toString());
        };

        // Compute titles.
        let titleGenerator: (index: number) => string;
        if (entry.xTitle) {
            titleGenerator = (index) => {
                return entry.xTitle!(xValues[index], index, xValues);
            };
        } else {
            //const formatValue = yScale.tickFormat(100, entry.yFormat);
            titleGenerator = (index) => {
                return `${String(xValues[index])}\n${String(yValues[index])}`;
            };
        }

        let yAxisHost = root.select<SVGSVGElement>(".yAxis");
        if (yAxisHost.empty()) {
            yAxisHost = root.append<SVGSVGElement>("g")
                .classed("yAxis", true);
        }

        // Have to do a hard type cast here, because I cannot get the transition (which is totally fine otherwise)
        // to be assignable to the transition functions below.
        const commonTransition = root.transition()
            .ease(d3.easeQuad)
            .duration(firstRun ? 0 : 500) as unknown as d3.Transition<d3.BaseType, DatumDataType, null, undefined>;

        const bars = root.selectAll("rect")
            .data(dataIndexes)
            .join("rect")
            .attr("fill", colorGenerator);

        let titles = bars.selectAll<HTMLTitleElement, number>("title");
        if (titles.empty()) {
            titles = bars.append("title");
        }
        titles.text(titleGenerator);

        if (yDataType === "object") {
            const yScaleBandTime = d3.scaleTime(yDomain as [Date, Date], yRange);
            const yAxisTime = d3.axisLeft(yScaleBandTime).ticks(this.height / 40, entry.yFormat);

            yAxisHost
                .transition(commonTransition)
                .attr("transform", `translate(${marginLeft},0)`)
                .call(yAxisTime);

            bars
                .transition(commonTransition)
                .attr("x", (index) => {
                    // We cannot test an undefined scale result, as we take out empty data above.
                    // istanbul ignore next
                    return xScaleBand(xValues[index]) ?? 0;
                })
                .attr("width", xScaleBand.bandwidth())
                .attr("y", (index) => {
                    return yScaleBandTime(yValues[index] as Date);
                })
                .attr("height", (index) => {
                    // istanbul ignore next
                    return (yScaleBandTime(0) ?? 0) - (yScaleBandTime(yValues[index] as Date) ?? 0);
                });
        } else if (yDataType === "number") {
            const yScaleBandLinear = d3.scaleLinear(yDomain as [number, number], yRange);
            const yAxisLinear = d3.axisLeft(yScaleBandLinear).ticks(this.height / 40, entry.yFormat);

            yAxisHost
                .transition(commonTransition)
                .attr("transform", `translate(${marginLeft},0)`)
                .call(yAxisLinear);

            bars
                .transition(commonTransition)
                .attr("x", (index) => {
                    // istanbul ignore next
                    return xScaleBand(xValues[index]) ?? 0;
                })
                .attr("width", xScaleBand.bandwidth())
                .attr("y", (index) => {
                    return yScaleBandLinear(yValues[index] as number);
                })
                .attr("height", (index) => {
                    // istanbul ignore next
                    return (yScaleBandLinear(0) ?? 0) - (yScaleBandLinear(yValues[index] as number) ?? 0);
                });
        } else {
            const yScaleBandOrdinal = d3.scaleOrdinal(yDomain, yRange);
            const yAxisOrdinal = d3.axisLeft(yScaleBandOrdinal).ticks(this.height / 40, entry.yFormat);

            yAxisHost
                .transition(commonTransition)
                .attr("transform", `translate(${marginLeft},0)`)
                .call(yAxisOrdinal);

            bars
                .transition(commonTransition)
                .attr("x", (index) => {
                    // istanbul ignore next
                    return xScaleBand(xValues[index]) ?? 0;
                })
                .attr("width", xScaleBand.bandwidth())
                .attr("y", (index) => {
                    return yScaleBandOrdinal(yValues[index]);
                })
                .attr("height", (index) => {
                    // istanbul ignore next
                    return (yScaleBandOrdinal(0) ?? 0) - (yScaleBandOrdinal(yValues[index]) ?? 0);
                });
        }

        let xAxisHost = root.select<SVGSVGElement>(".xAxis");
        if (xAxisHost.empty()) {
            xAxisHost = root.append<SVGSVGElement>("g")
                .classed("xAxis", true)
                .attr("transform", `translate(0,${this.height - marginBottom})`)
                .call(xAxis);
        }

        xAxisHost
            .transition(commonTransition)
            .attr("transform", `translate(0,${this.height - marginBottom})`)
            .call(xAxis);

        yAxisHost
            .call((g) => {
                // Add horizontal grid lines, by duplicating the auto generated tick lines from the y axis.
                const gridLines = g.selectAll(".tick .gridLine");
                gridLines.remove();
                g.selectAll(".tick line")
                    .clone()
                    .classed("gridLine", true)
                    .attr("stroke-opacity", 0.25)
                    .attr("stroke-width", 1)
                    .attr("x2", this.width - marginLeft - marginRight);
            });

        let yLabel = yAxisHost.select<SVGTextElement>(".yLabel");
        if (yLabel.empty()) {
            yLabel = yAxisHost.append("text")
                .classed("yLabel", true)
                .attr("y", 10)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start");
        }

        yLabel
            .text(entry.yLabel ?? "")
            .transition(commonTransition)
            .attr("x", -marginLeft);
    }

    private isTabularData(data: IGraphData): data is ITabularGraphData {
        const values = data as ITabularGraphData;

        return Array.isArray(values) && Array.isArray(values[0]);
    }
}
