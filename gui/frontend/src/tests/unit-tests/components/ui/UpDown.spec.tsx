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
import { describe, expect, it, vi } from "vitest";

import { useState } from "preact/hooks";

import { TextAlignment } from "../../../../components/ui/Label/Label.js";
import { UpDown } from "../../../../components/ui/UpDown/UpDown.js";

interface IProps {
    initialValue?: number;
    min?: number;
    max?: number;
    placeholder?: number;
}

const Wrapper = ({ initialValue, min, max, placeholder }: IProps) => {
    const [value, setValue] = useState(initialValue);

    return (
        <UpDown
            id="upDownInput"
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
        const onChange = vi.fn();
        const { unmount } = render(
            <UpDown<number>
                id="upDownId"
                value={10}
                textAlignment={TextAlignment.End}
                onChange={onChange}
            />,
        );

        expect(onChange).not.toHaveBeenCalled();
        const upButton = document.querySelector("#up");
        expect(upButton).toBeTruthy();

        await act(() => {
            fireEvent.click(upButton!);
        });
        expect(onChange).toHaveBeenCalled();

        const downButton = document.querySelector("#down");
        expect(downButton).toBeTruthy();

        await act(() => {
            fireEvent.click(downButton!);
        });
        expect(onChange).toHaveBeenCalled();

        unmount();
    });

    it("Test UpDown min max values", () => {
        const min = "9";
        const max = "11";
        const { unmount } = render(
            <Wrapper initialValue={10} min={Number(min)} max={Number(max)} />,
        );

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

        unmount();
    });

    it("Test UpDown with missing initial value and placeholder", () => {
        const placeholder = 10;
        const { unmount } = render(<Wrapper placeholder={placeholder} />);

        const inputElement = queryInput();
        expect(inputElement.placeholder).toBe(`${placeholder}`);
        expect(inputElement.value).toBe("");

        // Simulate entering text.
        fireEvent.input(inputElement, { target: { value: "15" } });
        expect(inputElement.value).toBe("15");

        fireEvent.input(inputElement, { target: { value: "" } });
        expect(inputElement.value).toBe("");

        unmount();
    });

    it("Test UpDown with non nullable value", () => {
        const { unmount } = render(<Wrapper initialValue={123} />);
        const inputElement = queryInput();
        fireEvent.doubleClick(inputElement); // Select all text.

        fireEvent.input(inputElement, {
            target: { value: "" },
        });
        expect(inputElement.value).toBe("0");

        unmount();
    });

    it("Test up button of UpDown with missing value", () => {
        const { unmount } = render(<Wrapper />);

        const upButton = queryUpButton();
        expect(upButton).toBeTruthy();
        fireEvent.click(upButton);
        const inputElement = queryInput();
        expect(inputElement.value).toBe("1");

        unmount();
    });

    it("Test down button of UpDown with missing value", () => {
        const { unmount } = render(<Wrapper />);

        const downButton = queryDownButton();
        expect(downButton).toBeTruthy();
        fireEvent.click(downButton);
        const inputElement = queryInput();
        expect(inputElement.value).toBe("-1");

        unmount();
    });

    it("Test Up button with placeholder and missing value", () => {
        const { unmount } = render(
            <Wrapper placeholder={10} />,
        );

        const upButton = queryUpButton();
        fireEvent.click(upButton);
        const inputElement = queryInput();
        expect(inputElement.value).toBe("11");

        fireEvent.input(inputElement, {
            target: { value: "" },
        });
        expect(inputElement.value).toBe("");

        unmount();
    });

    it("Test Down button with placeholder and missing value", () => {
        const { unmount } = render(
            <Wrapper placeholder={10} />,
        );

        const downButton = queryDownButton();
        fireEvent.click(downButton);
        const inputElement = queryInput();
        expect(inputElement.value).toBe("9");

        unmount();
    });

});
