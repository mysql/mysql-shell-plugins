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

import cloneIcon from "../../../../assets/images/clone.svg";

import { fireEvent } from "@testing-library/preact";
import { mount } from "enzyme";

import { ComponentPlacement } from "../../../../components/ui/Component/ComponentBase.js";
import { Menu } from "../../../../components/ui/Menu/Menu.js";
import { MenuBar } from "../../../../components/ui/Menu/MenuBar.js";
import { MenuItem } from "../../../../components/ui/Menu/MenuItem.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("Menu component tests", (): void => {
    it("Test Menu output (snapshot)", () => {
        const component = mount<Menu>(
            <Menu
                id="tileActionMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={jest.fn()}
            >
                <MenuItem command={{ title: "Heading", command: "item1" }} disabled />
                <MenuItem command={{ title: "Cut", command: "item2" }} />
                <MenuItem command={{ title: "Copy", command: "item3" }} />
                <MenuItem command={{ title: "Sub Menu 0", command: "" }}>
                    <MenuItem id="item5" icon={cloneIcon} command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item6" icon={cloneIcon} command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item7" icon={cloneIcon} command={{ title: "Item 3", command: "" }} />
                    <MenuItem id="item8" icon={cloneIcon} command={{ title: "Item 4", command: "" }} />
                </MenuItem>
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem id="item11" command={{ title: "Delete", command: "" }} icon={cloneIcon} />
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem id="item13" icon={cloneIcon} command={{ title: "Sub Menu 1", command: "" }} >
                    <MenuItem id="item20" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item21" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item22" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item30" command={{ title: "Item 4", command: "" }} />
                    <MenuItem id="item31" icon={cloneIcon} command={{ title: "Sub Menu 2", command: "" }} >
                        <MenuItem id="item40" command={{ title: "Item 1", command: "" }} />
                        <MenuItem id="item41" command={{ title: "Item 2", command: "" }} />
                        <MenuItem id="item42" command={{ title: "Item 3", command: "" }} />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem id="item44" command={{ title: "Item 4", command: "" }} />
                        <MenuItem id="item45" icon={cloneIcon} command={{ title: "Sub Menu 2", command: "" }} >
                            <MenuItem id="item50" command={{ title: "Item 1", command: "" }} />
                            <MenuItem id="item51" command={{ title: "Item 2", command: "" }} />
                            <MenuItem id="item52" command={{ title: "Item 3", command: "" }} />
                            <MenuItem command={{ title: "-", command: "" }} disabled />
                            <MenuItem id="item54" command={{ title: "Item 4", command: "" }} />
                            <MenuItem id="item55" icon={cloneIcon} command={{ title: "Sub Menu 2", command: "" }}>
                                <MenuItem id="item60" command={{ title: "Item 1", command: "" }} />
                                <MenuItem id="item61" command={{ title: "Item 2", command: "" }} />
                                <MenuItem id="item62" command={{ title: "Item 3", command: "" }} />
                                <MenuItem command={{ title: "-", command: "" }} disabled />
                                <MenuItem id="item64" command={{ title: "Item 4", command: "" }} />
                                <MenuItem id="item65" icon={cloneIcon} command={{ title: "Sub Menu 2", command: "" }}>
                                    <MenuItem id="item70" command={{ title: "Item 1", command: "" }} />
                                    <MenuItem id="item71" command={{ title: "Item 2", command: "" }} />
                                    <MenuItem id="item72" command={{ title: "Item 3", command: "" }} />
                                    <MenuItem command={{ title: "-", command: "" }} disabled />
                                    <MenuItem id="item74" command={{ title: "Item 4", command: "" }} />
                                    <MenuItem
                                        id="item75"
                                        icon={cloneIcon}
                                        command={{ title: "Sub Menu 2", command: "" }}
                                    >
                                        <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                                        <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                                        <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                                        <MenuItem command={{ title: "-", command: "" }} disabled />
                                        <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                                        <MenuItem id="item85"
                                            icon={cloneIcon}
                                            command={{ title: "Item 5", command: "" }}
                                        />
                                    </MenuItem>
                                </MenuItem >
                            </MenuItem >
                        </MenuItem >
                    </MenuItem >
                </MenuItem >
            </Menu >,
        );

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Test MenuBar output (snapshot)", () => {
        const component = mount<MenuBar>(
            <MenuBar>
                <MenuItem id="fileMenu" command={{ title: "File", command: "" }} >
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                    <MenuItem id="item65" icon={cloneIcon} command={{ title: "Sub Menu 2", command: "" }}>
                        <MenuItem id="item70" command={{ title: "Item 1", command: "" }} />
                        <MenuItem id="item71" command={{ title: "Item 2", command: "" }} />
                        <MenuItem id="item72" command={{ title: "Item 3", command: "" }} />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem id="item74" command={{ title: "Item 4", command: "" }} />
                        <MenuItem id="item75" icon={cloneIcon} command={{ title: "Sub Menu 2", command: "" }}>
                            <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                            <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                            <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                            <MenuItem command={{ title: "-", command: "" }} disabled />
                            <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                            <MenuItem id="item85" icon={cloneIcon} command={{ title: "Item 5", command: "" }} />
                        </MenuItem>
                    </MenuItem >
                </MenuItem >
                <MenuItem id="editMenu" command={{ title: "Edit", command: "" }} >
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem>
                <MenuItem id="selectionMenu" command={{ title: "Selection", command: "" }}>
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem >
                <MenuItem id="viewMenu" command={{ title: "View", command: "" }} >
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem>
                <MenuItem id="goMenu" command={{ title: "Go", command: "" }}>
                    <MenuItem id="item80" command={{ title: "Item 1", command: "" }} />
                    <MenuItem id="item81" command={{ title: "Item 2", command: "" }} />
                    <MenuItem id="item82" command={{ title: "Item 3", command: "" }} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem id="item84" command={{ title: "Item 4", command: "" }} />
                </MenuItem >
            </MenuBar >,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Test menu callbacks", async () => {
        const component = mount<Menu>(
            <Menu
                id="tileActionMenu"
                placement={ComponentPlacement.BottomLeft}
                onItemClick={jest.fn()}
            >
                <MenuItem id="edit" command={{ title: "Edit Connection…", command: "edit" }} icon={cloneIcon} />
                <MenuItem command={{ title: "Duplicate Connection…", command: "duplicate" }} icon={cloneIcon} />
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem command={{ title: "Share Connection", command: "shareConnection" }} icon={cloneIcon}>
                    <MenuItem command={{ title: "With User...", command: "shareWithUser" }} icon={cloneIcon} />
                    <MenuItem command={{ title: "-", command: "" }} disabled />
                    <MenuItem command={{ title: "Profile 1", command: "profile1" }} icon={cloneIcon} />
                    <MenuItem command={{ title: "Profile 2", command: "profile2" }} icon={cloneIcon} />
                    <MenuItem command={{ title: "Profile 3", command: "profile3" }} icon={cloneIcon} />
                </MenuItem>
                <MenuItem command={{ title: "Copy Connection to Profile", command: "copyConnection" }} icon={cloneIcon}>
                    <MenuItem command={{ title: "Profile 1", command: "profile1" }} icon={cloneIcon} />
                </MenuItem>
                <MenuItem command={{ title: "-", command: "" }} disabled />
                <MenuItem command={{ title: "Remove Connection…", command: "remove" }} />
            </Menu >,
        );

        // Keep in mind here that menu (popup, portal) content is not rendered in the same DOM tree as the menu itself!

        const itemClickSpy = jest.spyOn(component.props(), "onItemClick");

        const targetRect = new DOMRect(0, 0, 2, 2);
        component.instance().open(targetRect, false);
        await nextRunLoop();

        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        const items = portals[0].getElementsByClassName("menuItem");
        expect(items).toHaveLength(7);

        fireEvent.click(items[0]);
        expect(itemClickSpy).toHaveBeenCalled();
    });

});
