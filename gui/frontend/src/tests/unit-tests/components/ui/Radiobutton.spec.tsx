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

import { mount } from "enzyme";
import { act } from "preact/test-utils";

import { CheckState } from "../../../../components/ui/Checkbox/Checkbox.js";
import { Radiobutton, IRadiobuttonProperties } from "../../../../components/ui/Radiobutton/Radiobutton.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";

import { nextProcessTick, sendKeyPress } from "../../test-helpers.js";
import { mouseEventMock } from "../../__mocks__/EventMocks.js";

describe("Radiobutton component tests", (): void => {

    it("Test Radiobutton output 1", async () => {
        const component = mount(
            <Radiobutton id="rb1" onClick={jest.fn()} name="rb">
                Unchecked radiobutton
            </Radiobutton>,
        );
        expect(component).toBeTruthy();
        expect(component.text()).toEqual("Unchecked radiobutton");

        const instance = component.instance();
        const spyOnClick = jest.spyOn(instance.props as IRadiobuttonProperties, "onClick");
        expect(spyOnClick).not.toHaveBeenCalled();
        const click = (component.props() as IRadiobuttonProperties).onClick;
        await act(() => {
            click?.(mouseEventMock, { id: "1" });
        });
        expect(spyOnClick).toHaveBeenCalled();

        component.unmount();
    });

    it("Test Radiobutton output (snapshot)", () => {
        const component = mount<Radiobutton>(
            <Radiobutton
                id="rb4"
                name="rbx"
                disabled
                checkState={CheckState.Checked}
                caption="Disabled Radiobutton"
            />,
        );

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Radiobutton interaction", async () => {
        const component = mount<Radiobutton>(
            <Radiobutton
                id="rb4"
                name="rbx"
                disabled
                checkState={CheckState.Checked}
                caption="Disabled Radiobutton"
            />,
        );

        await nextProcessTick();

        const button = component.find(Radiobutton);
        expect(button).not.toBeNull();

        sendKeyPress(KeyboardKeys.Space);
        await nextProcessTick();

        component.unmount();
    });
});
