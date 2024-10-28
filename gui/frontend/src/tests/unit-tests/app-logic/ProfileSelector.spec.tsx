/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { act } from "@testing-library/preact";
import { mount } from "enzyme";
import { createRef } from "preact";

import { ProfileSelector } from "../../../app-logic/ProfileSelector.js";
import { Button } from "../../../components/ui/Button/Button.js";

import { mouseEventMock } from "../__mocks__/EventMocks.js";
import { setupShellForTests } from "../test-helpers.js";

let clicked = false;
const buttonClick = (): void => {
    clicked = true;
};

describe("ProfileSelector test", () => {

    beforeEach(() => {
        clicked = false;
    });

    it("Render Profile Selector and check properties", async () => {
        const actionMenuRef = createRef<ProfileSelector>();
        const innerRef = createRef<HTMLDivElement>();
        const component = mount(
            <div>
                <Button innerRef={innerRef} onClick={buttonClick}>
                    Open Profile Selector
                </Button>
                <ProfileSelector ref={actionMenuRef}></ProfileSelector>
            </div>,
        );

        expect(actionMenuRef.current).not.toEqual(document.activeElement);
        expect(component).toBeTruthy();

        expect(clicked).toEqual(false);
        const click = (component.find(Button).props()).onClick;
        await act(() => {
            click?.(mouseEventMock, { id: "1" });
            actionMenuRef.current?.open(component.getDOMNode().getBoundingClientRect());
        });
        expect(clicked).toEqual(true);

        let menuItem = component.find("#add");
        expect(menuItem).toBeTruthy();

        menuItem = component.find("#edit");
        expect(menuItem).toBeTruthy();

        menuItem = component.find("#delete");
        expect(menuItem).toBeTruthy();

        component.unmount();
    });

    it("Standard Rendering (snapshot)", async () => {
        const actionMenuRef = createRef<ProfileSelector>();
        const component = mount(
            <div>
                <Button onClick={buttonClick}>
                    Open Profile Selector
                </Button>
                <ProfileSelector ref={actionMenuRef}></ProfileSelector>
            </div>,
        );

        expect(actionMenuRef.current).not.toEqual(document.activeElement);
        expect(component).toBeTruthy();

        expect(clicked).toEqual(false);
        const click = (component.find(Button).props()).onClick;
        await act(() => {
            click?.(mouseEventMock, { id: "1" });
            actionMenuRef.current?.open(component.getDOMNode().getBoundingClientRect());
        });

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Update on connect", async () => {
        const launchPromise = setupShellForTests(false, true, "DEBUG3");

        const component = mount<ProfileSelector>(
            <ProfileSelector />,
        );

        const launcher = await launchPromise;

        // TODO: add check the profile selector has been updated on connect.

        await launcher.exitProcess();
        component.unmount();
    });
});
