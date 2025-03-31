/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { act, fireEvent, render } from "@testing-library/preact";
import { mount, shallow } from "enzyme";

import { TextAlignment } from "../../../../components/ui/Label/Label.js";
import { UpDown, IUpDownProperties } from "../../../../components/ui/UpDown/UpDown.js";

import { mouseEventMock } from "../../__mocks__/EventMocks.js";
import { useState } from "preact/hooks";

interface IProps {
    initialValue?: number;
    min?: number;
    max?: number;
    placeholder?: number;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const Wrapper = ({ initialValue, min, max, placeholder }: IProps) => {
    const [ value, setValue ] = useState(initialValue);

    return (
        <UpDown
            id="upDownId"
            value={value}
            onChange={setValue}
            min={min}
            max={max}
            step={1}
            placeholder={placeholder}
        />
    );
};

describe("UpDown render testing", (): void => {
    const queryInput = () => {
        return document.getElementById("upDownInput")! as HTMLInputElement;
    };
    const queryDownButton = () => {
        return document.getElementById("down") as Element;
    };
    const queryUpButton = () => {
        return document.getElementById("up") as Element;
    };

    it("Test UpDown callbacks", async () => {
        const component = shallow(
            <UpDown<number> onChange={jest.fn()} id="upDownId" value={10} textAlignment={TextAlignment.End} />,
        );
        expect(component).toBeTruthy();
        const instance = component.instance();

        const spyOnChange = jest.spyOn(instance.props as IUpDownProperties<number>, "onChange");
        expect(spyOnChange).not.toHaveBeenCalled();
        const upButton = component.find("#up");
        expect(upButton).toBeTruthy();
        let onClick = (upButton.first().props() as IUpDownProperties<number>).onClick;
        await act(() => {
            onClick?.(mouseEventMock, { id: "up" });
        });
        expect(spyOnChange).toHaveBeenCalled();

        spyOnChange.mockClear();
        expect(spyOnChange).not.toHaveBeenCalled();
        const downButton = component.find("#down");
        expect(downButton).toBeTruthy();
        onClick = (downButton.first().props() as IUpDownProperties<number>).onClick;
        await act(() => {
            onClick?.(mouseEventMock, { id: "up" });
        });
        expect(spyOnChange).toHaveBeenCalled();
    });

    it("Test UpDown min max values", () => {
        const min = "9";
        const max = "11";
        const component = render(
            <Wrapper initialValue={10} min={Number(min)} max={Number(max)} />,
        );
        expect(component).toBeTruthy();

        const upButton = queryUpButton();
        fireEvent.click(upButton);
        const inputElement = queryInput();
        expect(inputElement).toBeTruthy();
        expect(inputElement.value).toBe(max);

        fireEvent.click(upButton);
        expect(inputElement.value).toBe(max);

        const downButton = queryDownButton();
        fireEvent.click(downButton);
        expect(inputElement.value).toBe("10");

        fireEvent.click(downButton);
        expect(inputElement.value).toBe(min);

        fireEvent.click(downButton);
        expect(inputElement.value).toBe(min);
    });

    it("Test UpDown elements", () => {
        const component = mount<IUpDownProperties<number>>(
            <UpDown id="upDownId" value="10" textAlignment={TextAlignment.End} onChange={jest.fn()} />,
        );
        expect(component).toBeTruthy();
        const props = component.props();
        expect(props.id).toEqual("upDownId");
        expect(props.value).toEqual("10");
        expect(props.textAlignment).toEqual(TextAlignment.End);
    });

    it("Test UpDown with missing initial value and placeholder", () => {
        const placeholder = 10;
        render(<Wrapper placeholder={placeholder} />);
        const inputElement = queryInput();
        expect(inputElement.placeholder).toBe(`${placeholder}`);
        expect(inputElement.value).toBe("");

        // Simulate entering text.
        fireEvent.input(inputElement, { target: { value: "15" } });
        expect(inputElement.value).toBe("15");

        fireEvent.input(inputElement, { target: { value: "" } });
        expect(inputElement.value).toBe("");
    });

    it("Test UpDown with non nullable value", () => {
        render(<Wrapper initialValue={123} />);
        const inputElement = queryInput();
        fireEvent.doubleClick(inputElement); // Select all text.

        fireEvent.input(inputElement, {
            target: { value: "" },
        });
        expect(inputElement.value).toBe("0");
    });

    it("Test up button of UpDown with missing value", () => {
        render(<Wrapper />);

        const upButton = queryUpButton();
        expect(upButton).toBeTruthy();
        fireEvent.click(upButton);
        const inputElement = queryInput();
        expect(inputElement.value).toBe("1");
    });

    it("Test down button of UpDown with missing value", () => {
        render(<Wrapper />);

        const downButton = queryDownButton();
        expect(downButton).toBeTruthy();
        fireEvent.click(downButton);
        const inputElement = queryInput();
        expect(inputElement.value).toBe("-1");
    });
});
