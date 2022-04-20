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

import image from "../../../../assets/images/close.svg";

import React from "react";
import { mount, shallow } from "enzyme";
import { act } from "preact/test-utils";

import { Button, Image, Container, Orientation, ComponentSize, IButtonProperties } from "../../../../components/ui";
import { requisitions } from "../../../../supplement/Requisitions";
import { eventMock } from "../../__mocks__/MockEvents";
import { snapshotFromWrapper } from "../../test-helpers";

let clicked = false;

const buttonClick = (): void => {
    clicked = true;
};

const requestButtonClick = (): Promise<boolean> => {
    clicked = true;

    return Promise.resolve(true);
};

const sleepAsync = (callback: (flag: boolean) => void): ReturnType<typeof setImmediate> => {
    return setImmediate(() => { callback(clicked); });
};

describe("Button component tests", (): void => {

    beforeEach(() => {
        clicked = false;
    });

    afterAll(() => {
        requisitions.unregister(undefined, requestButtonClick);
    });

    it("Test button click", async () => {
        const component = shallow(
            <Button onClick={buttonClick}>
                Test button
            </Button>,
        );
        expect(component).toBeTruthy();
        expect(component.text()).toEqual("Test button");

        const click = (component.props() as IButtonProperties).onClick;
        await act(() => {
            click?.(eventMock, { id: "1" });
        });

        expect(clicked).toEqual(true);
    });

    it("Test button commands", (done) => {
        requisitions.register("testButtonClick", requestButtonClick);
        const component = shallow(
            <Button requestId="testButtonClick">
                Test button
            </Button>,
        );
        expect(component).toBeTruthy();
        expect(component.text()).toEqual("Test button");
        expect(clicked).toEqual(false);
        const click = (component.props() as IButtonProperties).onClick;
        void act(() => {
            return click?.(eventMock, { id: "1" });
        }).then(() => {
            sleepAsync((result: boolean) => {
                expect(result).toEqual(true);
                done();
            });
        });
    });

    it("Test button click", async () => {
        const innerRef = React.createRef<HTMLButtonElement>();
        const component = mount(
            <Button innerRef={innerRef} onClick={buttonClick}>
                Test button
            </Button>,
        );

        expect(innerRef.current).not.toEqual(document.activeElement);

        expect(component).toBeTruthy();
        expect(component.text()).toEqual("Test button");

        const click = (component.props() as IButtonProperties).onClick;
        await act(() => {
            click?.(eventMock, { id: "1" });
        });
        expect(clicked).toEqual(true);

        const onMouseDown = (component.props() as IButtonProperties).onMouseDown;
        await act(() => {
            onMouseDown?.(eventMock as React.MouseEvent, { id: "1" });
        });
        expect(innerRef.current).not.toEqual(document.activeElement);

        // component = mount(
        //     <Button innerRef={innerRef} onClick={buttonClick} focusOnClick>
        //         Test button
        //     </Button>,
        // );

        // onMouseDown = (component.props() as IButtonProperties).onMouseDown;
        // act(() =>  {
        //     onMouseDown?.(event, {id: "1"});
        // });
        // expect(innerRef.current).toEqual(document.activeElement);
    });

    it("Test checkbox output (Snapshot)", () => {
        const component = mount(
            <div>
                <Container>
                    <Button id="button1" caption="Normal Button" />
                    <Button id="button2" caption="Disabled Button" disabled />
                </Container>
                <Container>
                    <Button id="button3" orientation={Orientation.TopDown}>
                        Button<h2>with content</h2>
                    </Button>
                    <Button id="button4">
                        <Image src={image} />
                        Image Button
                    </Button>
                </Container>
                <Button
                    id="button5"
                    caption="Large Button"
                    size={ComponentSize.Big}
                />
                <Container>
                    <Button round>M</Button>
                    <Button round>
                        <Image src={image} />
                    </Button>
                </Container>
            </div>,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();
    });
});
