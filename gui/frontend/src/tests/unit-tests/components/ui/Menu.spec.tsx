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

import cloneIcon from "../../../../assets/images/clone.svg";

import { mount, shallow } from "enzyme";
import { act } from "@testing-library/preact";

import { mouseEventMock } from "../../__mocks__/MockEvents";
import { ComponentPlacement } from "../../../../components/ui/Component/ComponentBase";
import { Menu, IMenuProperties } from "../../../../components/ui/Menu/Menu";
import { MenuBar } from "../../../../components/ui/Menu/MenuBar";
import { MenuItem } from "../../../../components/ui/Menu/MenuItem";

describe("Menu component tests", (): void => {
    it("Test menu callbacks", async () => {
        const component = shallow(
            <Menu
                id="tileActionMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={jest.fn()}
            >
                <MenuItem id="edit" caption="Edit Connection…" icon={cloneIcon} />
                <MenuItem id="duplicate" caption="Duplicate Connection…" icon={cloneIcon} />
                <MenuItem caption="-" />
                <MenuItem id="shareConnection" caption="Share Connection" icon={cloneIcon}>
                    <MenuItem id="shareWithUser" caption="With User..." icon={cloneIcon} />
                    <MenuItem caption="-" />
                    <MenuItem id="profile1" caption="Profile 1" icon={cloneIcon} />
                    <MenuItem id="profile2" caption="Profile 2" icon={cloneIcon} />
                    <MenuItem id="profile3" caption="Profile 3" icon={cloneIcon} />
                </MenuItem>
                <MenuItem id="copyConnection" caption="Copy Connection to Profile" icon={cloneIcon}>
                    <MenuItem id="profile1" caption="Profile 1" icon={cloneIcon} />
                </MenuItem>
                <MenuItem caption="-" />
                <MenuItem id="remove" caption="Remove Connection…" />
            </Menu >);
        expect(component).toBeTruthy();
        // first simulate click to open menu
        let onClick = (component.props() as IMenuProperties).onClick;
        await act(() => {
            onClick?.(mouseEventMock, {});
        });

        const instance = component.instance();
        const item = component.find("#edit");
        const spyItemClick = jest.spyOn(instance.props as IMenuProperties, "onItemClick");
        expect(spyItemClick).not.toBeCalled();

        onClick = (item.props() as IMenuProperties).onClick;
        await act(() => {
            onClick?.(mouseEventMock, {});
        });
        expect(spyItemClick).toBeCalled();
    });

    it("Test Menu output (snapshot)", () => {
        const component = mount<Menu>(
            <Menu
                id="tileActionMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={jest.fn()}
            >
                <MenuItem id="item1" caption="Heading" disabled />
                <MenuItem id="item2" caption="Cut" />
                <MenuItem id="item3" caption="Copy" />
                <MenuItem id="item4" caption="Sub Menu 0">
                    <MenuItem id="item5" icon={cloneIcon} caption="Item 1" />
                    <MenuItem id="item6" icon={cloneIcon} caption="Item 2" />
                    <MenuItem id="item7" icon={cloneIcon} caption="Item 3" />
                    <MenuItem id="item8" icon={cloneIcon} caption="Item 4" />
                </MenuItem>
                <MenuItem id="item10" caption="-" />
                <MenuItem id="item11" caption="Delete" icon={cloneIcon} />
                <MenuItem id="item12" caption="-" />
                <MenuItem id="item13" icon={cloneIcon} caption="Sub Menu 1">
                    <MenuItem id="item20" caption="Item 1" />
                    <MenuItem id="item21" caption="Item 2" />
                    <MenuItem id="item22" caption="Item 3" />
                    <MenuItem id="item23" caption="-" />
                    <MenuItem id="item30" caption="Item 4" />
                    <MenuItem id="item31" icon={cloneIcon} caption="Sub Menu 2">
                        <MenuItem id="item40" caption="Item 1" />
                        <MenuItem id="item41" caption="Item 2" />
                        <MenuItem id="item42" caption="Item 3" />
                        <MenuItem id="item43" caption="-" />
                        <MenuItem id="item44" caption="Item 4" />
                        <MenuItem id="item45" icon={cloneIcon} caption="Sub Menu 2">
                            <MenuItem id="item50" caption="Item 1" />
                            <MenuItem id="item51" caption="Item 2" />
                            <MenuItem id="item52" caption="Item 3" />
                            <MenuItem id="item53" caption="-" />
                            <MenuItem id="item54" caption="Item 4" />
                            <MenuItem
                                id="item55"
                                icon={cloneIcon}
                                caption="Sub Menu 2"
                            >
                                <MenuItem id="item60" caption="Item 1" />
                                <MenuItem id="item61" caption="Item 2" />
                                <MenuItem id="item62" caption="Item 3" />
                                <MenuItem id="item63" caption="-" />
                                <MenuItem id="item64" caption="Item 4" />
                                <MenuItem
                                    id="item65"
                                    icon={cloneIcon}
                                    caption="Sub Menu 2"
                                >
                                    <MenuItem id="item70" caption="Item 1" />
                                    <MenuItem id="item71" caption="Item 2" />
                                    <MenuItem id="item72" caption="Item 3" />
                                    <MenuItem id="item73" caption="-" />
                                    <MenuItem id="item74" caption="Item 4" />
                                    <MenuItem
                                        id="item75"
                                        icon={cloneIcon}
                                        caption="Sub Menu 2"
                                    >
                                        <MenuItem id="item80" caption="Item 1" />
                                        <MenuItem id="item81" caption="Item 2" />
                                        <MenuItem id="item82" caption="Item 3" />
                                        <MenuItem id="item83" caption="-" />
                                        <MenuItem id="item84" caption="Item 4" />
                                        <MenuItem
                                            id="item85"
                                            icon={cloneIcon}
                                            caption="Item 5"
                                        />
                                    </MenuItem>
                                </MenuItem>
                            </MenuItem>
                        </MenuItem>
                    </MenuItem>
                </MenuItem>
            </Menu>,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Test MenuBar output (snapshot)", () => {
        const component = mount<MenuBar>(
            <MenuBar>
                <MenuItem id="fileMenu" caption="File">
                    <MenuItem id="item80" caption="Item 1" />
                    <MenuItem id="item81" caption="Item 2" />
                    <MenuItem id="item82" caption="Item 3" />
                    <MenuItem id="item83" caption="-" />
                    <MenuItem id="item84" caption="Item 4" />
                    <MenuItem id="item65" icon={cloneIcon} caption="Sub Menu 2">
                        <MenuItem id="item70" caption="Item 1" />
                        <MenuItem id="item71" caption="Item 2" />
                        <MenuItem id="item72" caption="Item 3" />
                        <MenuItem id="item73" caption="-" />
                        <MenuItem id="item74" caption="Item 4" />
                        <MenuItem id="item75" icon={cloneIcon} caption="Sub Menu 2">
                            <MenuItem id="item80" caption="Item 1" />
                            <MenuItem id="item81" caption="Item 2" />
                            <MenuItem id="item82" caption="Item 3" />
                            <MenuItem id="item83" caption="-" />
                            <MenuItem id="item84" caption="Item 4" />
                            <MenuItem id="item85" icon={cloneIcon} caption="Item 5" />
                        </MenuItem>
                    </MenuItem>
                </MenuItem>
                <MenuItem id="editMenu" caption="Edit">
                    <MenuItem id="item80" caption="Item 1" />
                    <MenuItem id="item81" caption="Item 2" />
                    <MenuItem id="item82" caption="Item 3" />
                    <MenuItem id="item83" caption="-" />
                    <MenuItem id="item84" caption="Item 4" />
                </MenuItem>
                <MenuItem id="selectionMenu" caption="Selection">
                    <MenuItem id="item80" caption="Item 1" />
                    <MenuItem id="item81" caption="Item 2" />
                    <MenuItem id="item82" caption="Item 3" />
                    <MenuItem id="item83" caption="-" />
                    <MenuItem id="item84" caption="Item 4" />
                </MenuItem>
                <MenuItem id="viewMenu" caption="View">
                    <MenuItem id="item80" caption="Item 1" />
                    <MenuItem id="item81" caption="Item 2" />
                    <MenuItem id="item82" caption="Item 3" />
                    <MenuItem id="item83" caption="-" />
                    <MenuItem id="item84" caption="Item 4" />
                </MenuItem>
                <MenuItem id="goMenu" caption="Go">
                    <MenuItem id="item80" caption="Item 1" />
                    <MenuItem id="item81" caption="Item 2" />
                    <MenuItem id="item82" caption="Item 3" />
                    <MenuItem id="item83" caption="-" />
                    <MenuItem id="item84" caption="Item 4" />
                </MenuItem>
            </MenuBar>,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });
});
