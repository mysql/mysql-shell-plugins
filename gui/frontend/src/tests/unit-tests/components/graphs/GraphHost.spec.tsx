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

import { mount } from "enzyme";

import { GraphHost } from "../../../../components/graphs/GraphHost.js";

describe("GraphHost Tests", () => {
    it("Base Rendering", () => {
        const component = mount<GraphHost>(
            <GraphHost
                options={{}}
            />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Render Combinations", () => {
        // Only a global color palette.
        const component = mount<GraphHost>(
            <GraphHost
                options={{
                    colors: ["red", "green", "blue"],
                    series: [
                        {
                            id: "graph1",
                            type: "bar",
                        },
                        {
                            id: "graph2",
                            type: "line",
                        },
                        {
                            id: "graph3",
                            type: "pie",
                        },
                    ],
                }}
            />,
        );

        expect(component).toMatchSnapshot();

        // Update with local color palettes.
        component.setProps({
            options: {
                colors: ["red", "green", "blue"],
                series: [
                    {
                        id: "graph4",
                        type: "bar",
                        colors: ["yellow", "pink", "black"],
                    },
                    {
                        id: "graph5",
                        type: "line",
                        colors: ["rose", "#123", "rgba(1, 1, 1, 1)"],
                    },
                    {
                        id: "graph6",
                        type: "pie",
                        colors: ["#FFFFFF", "#FFFFFF", "#FFFFFF"],
                    },
                ],
            },
        });

        component.unmount();
    });

});
