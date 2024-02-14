/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { PieGraphRenderer } from "../../../../components/graphs/PieGraphRenderer.js";

describe("PieGraphRenderer Tests", () => {
    it("Base Rendering", () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(svg);

        const renderer = new PieGraphRenderer();

        const configuration: IPieGraphConfiguration = {
            id: "graph1",
            type: "pie",
        };
        renderer.render(svg, configuration);

        expect(svg).toMatchSnapshot();
    });

    it("With Data and Updates", () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(svg);

        const renderer = new PieGraphRenderer();

        const configuration: IPieGraphConfiguration = {
            id: "graph2",
            type: "pie",
            data: [
                { value: 1 },
                { value: 2 },
                { value: 3 },
            ],
        };
        renderer.render(svg, configuration);
        expect(svg).toMatchSnapshot();

        configuration.borderColor = "red";
        configuration.borderRadius = 5;
        configuration.borderWidth = 10;
        configuration.colors = ["white", "silver", "gray"];
        configuration.padAngle = Math.PI / 2;
        configuration.padRadius = 1;
        configuration.startAngle = 0;
        configuration.endAngle = Math.PI;
        configuration.radius = [10, 300];

        renderer.render(svg, configuration);
        expect(svg).toMatchSnapshot();
    });
});
