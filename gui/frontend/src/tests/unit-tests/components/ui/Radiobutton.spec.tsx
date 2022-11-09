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

import { mount } from "enzyme";
import keyboardKey from "keyboard-key";
import { act } from "preact/test-utils";
import React from "react";

import { Radiobutton, CheckState, IRadiobuttonProperties } from "../../../../components/ui";
import { nextProcessTick, sendKeyPress, snapshotFromWrapper } from "../../test-helpers";
import { eventMock } from "../../__mocks__/MockEvents";

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
        expect(spyOnClick).not.toBeCalled();
        const click = (component.props() as IRadiobuttonProperties).onClick;
        await act(() => {
            click?.(eventMock, { id: "1" });
        });
        expect(spyOnClick).toBeCalled();

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

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

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

        sendKeyPress(keyboardKey.Spacebar);
        await nextProcessTick();

        component.unmount();
    });
});
