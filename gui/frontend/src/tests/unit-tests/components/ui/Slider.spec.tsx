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

import { Slider } from "../../../../components/ui/Slider/Slider.js";

describe("Slider component tests", (): void => {

    it("Standard Rendering", () => {
        const component = mount<Slider>(
            <Slider
                id="slider1"
                value={0.3}
            />,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Value Change", () => {
        const component = mount<Slider>(
            <Slider
                id="slider1"
                value={0.3}
                onChange={jest.fn()}
            />,
        );
        expect(component).toMatchSnapshot();
        const instance = component.instance();

        const spyOnChange = jest.spyOn(instance.props, "onChange");
        instance.value = 0.8;
        expect(spyOnChange).toBeCalledWith(0.8);

        component.unmount();
    });

});
