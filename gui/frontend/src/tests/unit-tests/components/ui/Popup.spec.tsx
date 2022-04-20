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
import React from "react";

import { IPopupProperties, Popup } from "../../../../components/ui";
import { snapshotFromWrapper } from "../../test-helpers";

const popupRef = React.createRef<Popup>();

describe("Popup component tests", (): void => {

    it("Test Popup callbacks", (done) => {
        const popup = mount(
            <Popup
                showArrow={false}
                pinned={false}
                onClose={jest.fn()}
                onOpen={jest.fn()}
                ref={popupRef}
            >
                Test content
            </Popup>,
        );
        const instance = popup.instance();
        const spyOnOpen = jest.spyOn(instance.props as IPopupProperties, "onOpen");
        const spyOnCancel = jest.spyOn(instance.props as IPopupProperties, "onClose");

        expect(popup).toBeTruthy();
        popupRef.current?.open(new DOMRect(0, 0, 100, 100), { backgroundOpacity: 0 });

        // The open and close calls call their associated callbacks asynchronously (in multiple steps), so we have
        // delay the spy check a bit.
        setTimeout(() => {
            expect(spyOnOpen).toBeCalled();
            setTimeout(() => {
                popupRef.current?.close();
                expect(spyOnCancel).toBeCalled();

                done();
            }, 500);
        }, 500);
    });

    it("Test Popup output (Snapshot)", () => {
        const component = mount<Popup>(
            <Popup
                showArrow={false}
                pinned={false}
                onClose={jest.fn()}
                onOpen={jest.fn()}
            >
                Test content
            </Popup>,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();
    });
});
