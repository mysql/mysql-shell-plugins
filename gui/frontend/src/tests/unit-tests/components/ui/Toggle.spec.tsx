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

import Color from "color";
import { mount } from "enzyme";

import { CheckState } from "../../../../components/ui/Checkbox/Checkbox.js";
import { Toggle, IToggleProperties } from "../../../../components/ui/Toggle/Toggle.js";

describe("Toggle testing", () => {

    it("Toggle test properties", () => {
        const component = mount(
            <Toggle
                checkState={CheckState.Checked}
                disabled={false}
                round={true}
                caption="My toggle"
                borderWidth={123}
                color={Color.rgb(12, 12, 12)}
                checkedColor={Color.rgb(1, 1, 1)}
            />,
        );
        expect(component).toBeTruthy();
        const props = component.props() as IToggleProperties;
        expect(props.checkState).toEqual(CheckState.Checked);
        expect(props.disabled).toEqual(false);
        expect(props.round).toEqual(true);
        expect(props.caption).toEqual("My toggle");
        expect(props.borderWidth).toEqual(123);
        expect(props.color).toEqual(Color.rgb(12, 12, 12));
        expect(props.checkedColor).toEqual(Color.rgb(1, 1, 1));
    });

    it("Render test", () => {
        const component = mount(
            <Toggle
                checkState={CheckState.Checked}
                disabled={false}
                round={true}
                caption="My toggle"
                borderWidth={123}
                color={Color.rgb(12, 12, 12)}
                checkedColor={Color.rgb(1, 1, 1)}
            />,
        );
        expect(component).toMatchSnapshot();
        component.unmount();
    });

});
