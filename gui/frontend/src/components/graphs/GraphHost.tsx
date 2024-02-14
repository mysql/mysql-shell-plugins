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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ComponentChild, createRef } from "preact";

import { IComponentProperties, ComponentBase } from "../ui/Component/ComponentBase.js";

import { BarGraphRenderer } from "./BarGraphRenderer.js";
import { LineGraphRenderer } from "./LineGraphRenderer.js";
import { PieGraphRenderer } from "./PieGraphRenderer.js";

interface IGraphHostProps extends IComponentProperties {
    options: IGraphOptions;
}

// This is the actual component to render a Pie graph.
export class GraphHost extends ComponentBase<IGraphHostProps> {

    private svgRef = createRef<SVGSVGElement>();

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

    public render(): ComponentChild {
        const { id, options } = this.mergedProps;

        const className = this.getEffectiveClassNames(["graphHost"]);
        const left = options.viewport?.left ?? 0;
        const top = options.viewport?.top ?? 0;

        // Make the viewport a 3/4 re
        const width = options.viewport?.width ?? 1200;
        const height = options.viewport?.height ?? 900;


        return (
            <svg
                ref={this.svgRef}
                id={id}
                className={className}
                viewBox={`${left} ${top} ${width} ${height}`}
                preserveAspectRatio="xMidYMid"
            />
        );
    }

    private update = (): void => {
        const { options } = this.mergedProps;

        // istanbul ignore else
        if (this.svgRef.current) {
            // Remove previously rendered graphs which are not in the current configuration.
            const existing = this.svgRef.current.getElementsByTagName("svg");

            for (let i = 0; i < existing.length; ++i) {
                const element = existing.item(i);
                if (element && element.id) {
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
                        if (!entry.colors) {
                            entry.colors = options.colors;
                        }
                        renderer.render(this.svgRef.current!, entry);
                        break;
                    }

                    case "line": {
                        const renderer = new LineGraphRenderer();
                        if (!entry.colors) {
                            entry.colors = options.colors;
                        }
                        renderer.render(this.svgRef.current!, entry);
                        break;
                    }

                    case "bar": {
                        const renderer = new BarGraphRenderer();
                        if (!entry.colors) {
                            entry.colors = options.colors;
                        }
                        renderer.render(this.svgRef.current!, entry);
                        break;
                    }

                    // istanbul ignore next
                    default:
                }
            });
        }
    };
}
