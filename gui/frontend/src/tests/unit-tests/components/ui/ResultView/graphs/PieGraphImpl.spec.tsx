/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { mount } from "enzyme";
import React from "react";

import { PieGraphImpl } from "../../../../../../components/ResultView";
import { PieGraphProxy } from "../../../../../../modules/scripting/PieGraph";
import { snapshotFromWrapper } from "../../../../test-helpers";

describe("Pie Graph Impl Tests", (): void => {

    it("Standard Rendering (no data)", () => {
        const component = mount(
            <PieGraphImpl />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Rendering (invalid data)", () => {
        const datum = { value: 3.7 };
        const data = new Array(150).fill(datum);
        const component = mount(
            <PieGraphImpl
                width={-100}
                height={100 / 0}
                centerX={100 / 0}
                centerY={"abc" as unknown as number}
                innerRadius={200}
                outerRadius={-200}
                pointData={data}
            />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Render With Data", () => {
        const component = mount(
            <PieGraphImpl
                width={100}
                height={100}
                innerRadius={100 / 0}
                pointData={[{ value: 1, color: "#123" }, { value: 2 }]}
            />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.setProps({ width: 200, pointData: PieGraphProxy.demoData.budget });

        component.unmount();
    });

});
