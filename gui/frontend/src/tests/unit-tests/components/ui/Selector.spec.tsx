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

import { act } from "preact/test-utils";

import { Orientation } from "../../../../components/ui/Container/Container.js";
import { Label } from "../../../../components/ui/Label/Label.js";
import { Selector } from "../../../../components/ui/Selector/Selector.js";
import { Assets } from "../../../../supplement/Assets.js";

describe("Selector component tests", (): void => {

    const itemArray = [
        { caption: "1", icon: Assets.documents.overviewPageIcon },
        { caption: "2", icon: Assets.documents.overviewPageIcon },
        { caption: "3", icon: Assets.documents.overviewPageIcon },
        { caption: "4", icon: Assets.documents.overviewPageIcon },
        { caption: "5", icon: Assets.documents.overviewPageIcon },
        { caption: "6", icon: Assets.documents.overviewPageIcon },
        { caption: "7", icon: Assets.documents.overviewPageIcon },
        { caption: "8", icon: Assets.documents.overviewPageIcon },
        { caption: "9", icon: Assets.documents.overviewPageIcon },
        { caption: "10", icon: Assets.documents.overviewPageIcon },
    ];

    it("Test Selector onSelect callback", async () => {
        const component = shallow<Selector>(
            <Selector
                id="selector1"
                orientation={Orientation.TopDown}
                smoothScroll={true}
                onSelect={jest.fn()}
                items={[
                    { caption: "1", icon: Assets.documents.overviewPageIcon },
                    { caption: "2", icon: Assets.documents.overviewPageIcon },
                    { caption: "3", icon: Assets.documents.overviewPageIcon },
                    { caption: "4", icon: Assets.documents.overviewPageIcon },
                    { caption: "5", icon: Assets.documents.overviewPageIcon },
                    { caption: "6", icon: Assets.documents.overviewPageIcon },
                    { caption: "7", icon: Assets.documents.overviewPageIcon },
                    { caption: "8", icon: Assets.documents.overviewPageIcon },
                    { caption: "9", icon: Assets.documents.overviewPageIcon },
                    { caption: "10", icon: Assets.documents.overviewPageIcon },
                ]}
            />,
        );
        const instance = component.instance();
        const spyOnChange = jest.spyOn(instance.props, "onSelect");

        await act(() => {
            instance.props.onSelect?.("5");
        });
        expect(spyOnChange).toHaveBeenCalled();
    });

    it("Test Selector properties and updates", () => {
        const component = mount<Selector>(
            <Selector
                id="selector1"
                orientation={Orientation.TopDown}
                smoothScroll={true}
                items={itemArray}
            />,
        );

        const props = component.props();
        expect(props.smoothScroll).toBe(true);
        expect(props.orientation).toBe(Orientation.TopDown);
        expect(props.items).toBe(itemArray);

        // Component updates.
        component.setProps({ items: [], id: undefined });
        expect(component.instance().props.items?.length).toBe(0);
    });

    it("Test Selector with children", () => {
        const component = mount<Selector>(
            <Selector
                id="selector1"
                orientation={Orientation.TopDown}
                smoothScroll={true}
            >
                <Label>Lorem Ipsum</Label>
                123
            </Selector>,
        );

        const props = component.props();
        expect(props.items).toBe(undefined);

    });

    it("Test Selector output (snapshot)", () => {
        const component = mount<Selector>(
            <Selector
                id="selector1"
                orientation={Orientation.TopDown}
                smoothScroll={true}
                items={itemArray}
            />,
        );
        expect(component).toMatchSnapshot();
    });

});
