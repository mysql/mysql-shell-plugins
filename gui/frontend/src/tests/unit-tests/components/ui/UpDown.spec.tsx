/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { act } from "@testing-library/preact";
import { mount, shallow } from "enzyme";

import { TextAlignment } from "../../../../components/ui/Label/Label";
import { UpDown, IUpDownProperties, IUpDownState } from "../../../../components/ui/UpDown/UpDown";

import { mouseEventMock } from "../../__mocks__/MockEvents";

describe("UpDown render testing", (): void => {

    it("Test UpDown callbacks", async () => {
        const component = shallow(
            <UpDown onChange={jest.fn()} id="upDownId" value="10" textAlignment={TextAlignment.End} />,
        );
        expect(component).toBeTruthy();
        const instance = component.instance();

        const spyOnChange = jest.spyOn(instance.props as IUpDownProperties, "onChange");
        expect(spyOnChange).not.toBeCalled();
        const upButton = component.find("#up");
        expect(upButton).toBeTruthy();
        let onClick = (upButton.first().props() as IUpDownProperties).onClick;
        await act(() => {
            onClick?.(mouseEventMock, { id: "up" });
        });
        //upButton.simulate("click", { e: {} }, { props: { id: "up" } });
        expect(spyOnChange).toBeCalled();

        spyOnChange.mockClear();
        expect(spyOnChange).not.toBeCalled();
        const downButton = component.find("#down");
        expect(downButton).toBeTruthy();
        onClick = (downButton.first().props() as IUpDownProperties).onClick;
        await act(() => {
            onClick?.(mouseEventMock, { id: "up" });
        });
        expect(spyOnChange).toBeCalled();
    });

    it("Test UpDown values", async () => {
        const component = shallow<IUpDownProperties, IUpDownState>(
            <UpDown id="upDownId" value="10" min={9} max={11} step={1} textAlignment={TextAlignment.End} />,
        );
        expect(component).toBeTruthy();

        const upButton = component.find("#up");
        expect(upButton).toBeTruthy();
        let onClick = (upButton.first().props() as IUpDownProperties).onClick;
        await act(() => {
            onClick?.(mouseEventMock, { id: "up" });
        });

        expect(component.state().currentValue).toBe(11);

        const downButton = component.find("#down");
        expect(downButton).toBeTruthy();
        onClick = (downButton.first().props() as IUpDownProperties).onClick;
        await act(() => {
            onClick?.(mouseEventMock, { id: "down" });
        });
        expect(component.state().currentValue).toBe(10);
        await act(() => {
            onClick?.(mouseEventMock, { id: "down" });
        });
        expect(component.state().currentValue).toBe(9);
        await act(() => {
            onClick?.(mouseEventMock, { id: "down" });
        });
        expect(component.state().currentValue).toBe(9);
    });


    it("Test UpDown elements", () => {
        const component = mount<IUpDownProperties>(
            <UpDown id="upDownId" value="10" textAlignment={TextAlignment.End} />,
        );
        expect(component).toBeTruthy();
        const props = component.props();
        expect(props.id).toEqual("upDownId");
        expect(props.value).toEqual("10");
        expect(props.textAlignment).toEqual(TextAlignment.End);
    });

    it("Test UpDown output (Snapshot)", () => {
        const component = mount<UpDown>(
            <UpDown
                textAlignment={TextAlignment.Center}
                items={[
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                ]}
            />,
        );
        expect(component).toMatchSnapshot();
    });

});
