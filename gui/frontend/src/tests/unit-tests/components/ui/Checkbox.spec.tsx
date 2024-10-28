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
import { act } from "@testing-library/preact";

import { Checkbox, CheckState, ICheckboxProperties } from "../../../../components/ui/Checkbox/Checkbox.js";
import { mouseEventMock } from "../../__mocks__/EventMocks.js";

describe("Checkbox component tests", (): void => {
    it("Test checkbox click", async () => {
        const checkbox = shallow(
            <Checkbox
                id="cb1"
                checkState={CheckState.Unchecked}
                onChange={jest.fn()}
            >
                Off
            </Checkbox>,
        );
        expect(checkbox).toBeTruthy();
        expect(checkbox.text()).toEqual("Off");
        const chb = checkbox.find("label");
        expect(chb.hasClass("unchecked")).toBeTruthy();

        const instance = checkbox.instance();
        const spyOnChange = jest.spyOn(instance.props as ICheckboxProperties, "onChange");
        const click = (checkbox.props() as ICheckboxProperties).onClick;
        await act(() => {
            click?.(mouseEventMock, { id: "1" });
        });
        expect(spyOnChange).toHaveBeenCalled();
    });

    it("Test checkbox output (Snapshot)", () => {
        const component = mount(
            <div>
                <Checkbox id="cb1">
                    Unchecked checkbox
                </Checkbox>
                <Checkbox
                    id="cb2"
                    checkState={CheckState.Indeterminate}
                >
                    Indeterminate checkbox
                </Checkbox>
                <Checkbox id="cb3" checkState={CheckState.Checked}>
                    Checked checkbox
                </Checkbox>
                <Checkbox
                    id="cb4"
                    disabled
                    checkState={CheckState.Indeterminate}
                >
                    Disabled checkbox
                </Checkbox>
            </div>,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });
});
