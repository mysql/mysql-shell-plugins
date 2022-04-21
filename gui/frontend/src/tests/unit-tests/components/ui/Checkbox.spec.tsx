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

import React from "react";
import { mount, shallow } from "enzyme";
import { act } from "@testing-library/preact";

import { Checkbox, CheckState, ICheckboxProperties } from "../../../../components/ui";
import { eventMock } from "../../__mocks__/MockEvents";
import { snapshotFromWrapper } from "../../test-helpers";

describe("Checkbox component tests", (): void => {
    it("Test checkbox click", async () => {
        const checkbox = shallow(
            <Checkbox
                id="cb1"
                checkState={CheckState.Unchecked}
                name="cb"
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
            click?.(eventMock, { id: "1" });
        });
        expect(spyOnChange).toBeCalled();
    });

    it("Test checkbox output (Snapshot)", () => {
        const component = mount(
            <div>
                <Checkbox id="cb1" name="cb">
                    Unchecked checkbox
                </Checkbox>
                <Checkbox
                    id="cb2"
                    name="cb"
                    checkState={CheckState.Indeterminate}
                >
                    Indeterminate checkbox
                </Checkbox>
                <Checkbox id="cb3" name="cb" checkState={CheckState.Checked}>
                    Checked checkbox
                </Checkbox>
                <Checkbox
                    id="cb4"
                    name="cb"
                    disabled
                    checkState={CheckState.Indeterminate}
                >
                    Disabled checkbox
                </Checkbox>
            </div>,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });
});
