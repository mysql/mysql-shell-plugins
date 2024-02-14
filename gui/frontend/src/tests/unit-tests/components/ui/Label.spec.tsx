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

import { mount, shallow } from "enzyme";

import { ComponentSize } from "../../../../components/ui/Component/ComponentBase.js";
import { Label, TextAlignment, ILabelProperties } from "../../../../components/ui/Label/Label.js";

import { loremIpsum } from "../../test-helpers.js";

describe("Label component test", (): void => {

    it("Test Label elements", () => {
        const component = shallow<Label>(
            <Label
                id="myLabel1"
                textAlignment={TextAlignment.Center}
                size={ComponentSize.Tiny}>
                Tiny Label
            </Label>,
        );
        expect(component).toBeTruthy();
        const props = component.props();
        expect(props.id).toEqual("myLabel1");
    });


    it("Test Label output", () => {
        const component = mount<Label>(
            <Label>A Label</Label>,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Label with ansi formatting", () => {
        const component = shallow<ILabelProperties>(
            <Label
                caption={loremIpsum}
                language="ansi"
            />,
        );

        const props = component.props();
        expect(props.className).toEqual("msg resultText");
    });

    it("Label with ansi formatting", () => {
        const component = mount<Label>(
            <Label
                language="ansi"
                caption={loremIpsum}
            />,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

});
