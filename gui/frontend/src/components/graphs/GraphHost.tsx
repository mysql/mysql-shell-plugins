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

import { Component, IComponentProperties } from "../ui";
import { BarGraphRenderer } from "./BarGraphRenderer";
import { LineGraphRenderer } from "./LineGraphRenderer";
import { PieGraphRenderer } from "./PieGraphRenderer";

export interface IGraphHostProps extends IComponentProperties {
    options: IGraphOptions;
}

// This is the actual component to render a Pie graph.
export class GraphHost extends Component<IGraphHostProps> {

    private svgRef = React.createRef<SVGSVGElement>();

    public constructor(props: IGraphHostProps) {
        super(props);

        this.addHandledProperties("options");
    }

    public componentDidMount(): void {
        this.update();
    }

    public componentDidUpdate(): void {
        this.update();
    }

    public render(): React.ReactNode {
        const { id, options } = this.mergedProps;

        const className = this.getEffectiveClassNames(["graphHost"]);
        const left = options.viewport?.left ?? 0;
        const top = options.viewport?.top ?? 0;
        const width = options.viewport?.width ?? 400;
        const height = options.viewport?.height ?? 300;


        return (
            <svg
                ref={this.svgRef}
                id={id}
                className={className}
                width={"100%"}
                height={"100%"}
                viewBox={`${left} ${top} ${width} ${height}`}
                preserveAspectRatio="xMinYMin"
            />
        );
    }

    private update = (): void => {
        const { options } = this.mergedProps;

        // istanbul ignore else
        if (this.svgRef.current) {
            options.series?.forEach((entry, index) => {
                switch (entry.type) {
                    case "pie": {
                        const renderer = new PieGraphRenderer();
                        if (!entry.colors) {
                            entry.colors = options.colors;
                        }
                        renderer.render(this.svgRef.current!, entry, index);
                        break;
                    }

                    case "line": {
                        const renderer = new LineGraphRenderer();
                        if (!entry.colors) {
                            entry.colors = options.colors;
                        }
                        renderer.render(this.svgRef.current!, entry, index);
                        break;
                    }

                    case "bar": {
                        const renderer = new BarGraphRenderer();
                        if (!entry.colors) {
                            entry.colors = options.colors;
                        }
                        renderer.render(this.svgRef.current!, entry, index);
                        break;
                    }

                    // istanbul ignore next
                    default:
                }
            });
        }
    };
}
