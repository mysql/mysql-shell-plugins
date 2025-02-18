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

import { mount, shallow } from "enzyme";
import { createRef } from "preact";
import { act } from "preact/test-utils";

import { Button, IButtonProperties } from "../../../../components/ui/Button/Button.js";
import { ComponentSize } from "../../../../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../../../../components/ui/Container/Container.js";
import { Image } from "../../../../components/ui/Image/Image.js";
import { Assets } from "../../../../supplement/Assets.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { mouseEventMock } from "../../__mocks__/EventMocks.js";

let clicked = false;

const buttonClick = (): void => {
    clicked = true;
};

const requestButtonClick = (): Promise<boolean> => {
    clicked = true;

    return Promise.resolve(true);
};

const sleepAsync = (callback: (flag: boolean) => void): ReturnType<typeof setTimeout> => {
    return setTimeout(() => { callback(clicked); }, 0);
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
            click?.(mouseEventMock, { id: "1" });
        });

        expect(clicked).toEqual(true);
    });

    it("Test button commands", (done) => {
        requisitions.register("editorCommit", requestButtonClick);
        const component = shallow(
            <Button requestType="editorCommit">
                Test button
            </Button >,
        );

        expect(component.text()).toEqual("Test button");
        expect(clicked).toEqual(false);
        const click = (component.props() as IButtonProperties).onClick;
        void act(() => {
            return click?.(mouseEventMock, { id: "1" });
        }).then(() => {
            sleepAsync((result: boolean) => {
                expect(result).toEqual(true);
                done();
            });
        });
    });

    it("Test button click", async () => {
        const innerRef = createRef<HTMLDivElement>();
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
            click?.(mouseEventMock, { id: "1" });
        });
        expect(clicked).toEqual(true);

        const onMouseDown = (component.props() as IButtonProperties).onMouseDown;
        await act(() => {
            onMouseDown?.(mouseEventMock, { id: "1" });
        });
        expect(innerRef.current).not.toEqual(document.activeElement);

        component.unmount();
    });

    it("Test button output (Snapshot)", () => {
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
                        <Image src={Assets.misc.closeIcon} />
                        Image Button
                    </Button>
                </Container>
                <Button
                    id="button5"
                    caption="Large Button"
                    size={ComponentSize.Big}
                />
                <Button
                    id="button6"
                    caption="Large Button"
                    size={ComponentSize.Big}
                    requestType="editorChanged"
                    title="Test"
                />
                <Container>
                    <Button round>M</Button>
                    <Button round>
                        <Image src={Assets.misc.closeIcon} />
                    </Button>
                </Container>
            </div>,
        );

        expect(component).toMatchSnapshot();

        component.unmount();
    });
});
