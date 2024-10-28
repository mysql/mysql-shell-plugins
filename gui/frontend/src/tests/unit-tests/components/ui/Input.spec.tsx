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
import { act, render } from "@testing-library/preact";

import { IInputChangeProperties, Input } from "../../../../components/ui/Input/Input.js";
import { inputEventMock } from "../../__mocks__/EventMocks.js";

let inputText = "initial text";
const handleInput = (event: InputEvent, props: IInputChangeProperties): void => {
    if (props.id === "input1") {
        inputText = props.value;
    }
};

describe("Input render testing", (): void => {

    it("Test input callbacks", async () => {
        const input = mount(
            <Input
                id="input1"
                disabled={false}
                password={false}
                value={inputText}
                onChange={handleInput}
                onBlur={jest.fn()}
                onFocus={jest.fn()}
                onConfirm={jest.fn()}
                onCancel={jest.fn()}
            >
            </Input>,
        );
        expect(input).toBeTruthy();
        expect(inputText).toEqual("initial text");
        const onChange = (input.props() as IInputChangeProperties).onChange;
        await act(() => {
            onChange?.(inputEventMock, { id: "input1", value: "new value" });
        });
        expect(inputText).toEqual("new value");
        // const instance = input.instance();
        // const spyFocus = jest.spyOn(instance.props as IInputProperties, "onFocus");
        // const onFocus = (input.first().props() as IInputProperties).onFocus;
        // act(() =>  {
        //     onFocus?.(eventMock, { id: "1" });
        // });
        // expect(spyFocus).toHaveBeenCalled();
        // const spyOnConfirm = jest.spyOn(instance.props as IInputProperties, "onConfirm");
        // //input.simulate("keypress", { keyCode: keyboardKey.Enter, target: { value: "" } });
        // const onKeyPress = (input.first().props() as IInputChangeProperties ).onKeyPress;
        // act(() =>  {
        //     onKeyPress?.(eventMock, { keyCode: keyboardKey.Enter, target: { value: "" } });
        // });
        // expect(spyOnConfirm).toHaveBeenCalled();
        // const spyOnCancel = jest.spyOn(instance.props as IInputProperties, "onCancel");
        // input.simulate("keydown", { keyCode: keyboardKey.Escape, target: { value: "" } });
        // expect(spyOnCancel).toHaveBeenCalled();
        // const spyOnBlur = jest.spyOn(instance.props as IInputProperties, "onBlur");
        // input.simulate("blur", { target: { value: "" } });
        // expect(spyOnBlur).toHaveBeenCalled();
    });


    it("Test Input elements", () => {
        const component = shallow<Input>(
            <Input id="input1" placeholder="Enter something" />,
        );

        const props = component.props();
        expect(props.id).toEqual("input1");
        expect(props.placeholder).toEqual("Enter something");
    });

    it("Test Input output (Snapshot)", () => {
        const { container } = render(
            <Input id="input2" disabled placeholder="Disabled input" />,
        );
        expect(container.textContent).toMatchSnapshot();
    });

});
