/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { LineGraphRenderer } from "../../../../components/graphs/LineGraphRenderer";
import { nextProcessTick, sendPointerMoveSequence } from "../../test-helpers";

describe("LineGraphRenderer Tests", () => {
    it("Base Rendering", async () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(svg);

        const renderer = new LineGraphRenderer();

        const configuration: ILineGraphConfiguration = {
            id: "graph1",
            type: "line",
        };

        renderer.render(svg, configuration);
        expect(svg).toMatchSnapshot();

        configuration.data = [];
        renderer.render(svg, configuration);
        await nextProcessTick();

        expect(svg).toMatchSnapshot();
    });

    it("With Data and Updates", async () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(svg);

        const renderer = new LineGraphRenderer();

        const configuration: ILineGraphConfiguration = {
            id: "graph2",
            type: "line",
            data: [
                { xValue: 1, yValue: 10 },
                { xValue: 2, yValue: 20 },
                { xValue: 3, yValue: 30 },
            ],
        };
        renderer.render(svg, configuration);
        await nextProcessTick();

        expect(svg).toMatchSnapshot();

        configuration.xTitle = (): string => {
            return "TITLE";
        };
        configuration.marginTop = 111;
        configuration.marginRight = 222;
        configuration.marginBottom = 333;
        configuration.marginLeft = 444;
        configuration.xDomain = [0, 5];
        configuration.yDomain = [0, 50];
        configuration.colors = ["#00FF00"];
        configuration.strokeWidth = 2;
        configuration.strokeLinejoin = "round";
        configuration.strokeLinecap = "round";
        configuration.yFormat = "2.2f";
        configuration.yLabel = "Values in range";

        renderer.render(svg, configuration);
        await nextProcessTick();

        expect(svg).toMatchSnapshot();

        configuration.data = [{ xValue: new Date("2022-05-13"), yValue: 42 }];
        configuration.xDomain = undefined;
        renderer.render(svg, configuration);
        await nextProcessTick();

        expect(svg).toMatchSnapshot();

        configuration.data = [];
        renderer.render(svg, configuration);
        await nextProcessTick();

        expect(svg).toMatchSnapshot();

        // This serves solely to get coverage for the pointer handlers. We could also disable coverage for it,
        // but I prefer to actually execute the code, to see at least runtime errors.
        await sendPointerMoveSequence(svg, true);

        // Without the xTitle function a different title generator is used.
        configuration.xTitle = undefined;
        renderer.render(svg, configuration);
        await nextProcessTick();

        await sendPointerMoveSequence(svg, true);

        expect(svg).toMatchSnapshot();
    });
});
