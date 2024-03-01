/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { mount } from "enzyme";

import { HelpLinkList } from "../../../../components/ui/HelpLinkList/HelpLinkList.js";

describe("HelpLinkList component tests", (): void => {
    const helpUrlMap = new Map<string, string>([
        ["foo", "bar"],
        ["baz", "qux"],
    ]);

    it("Test component content", () => {
        let component = mount(
            <HelpLinkList />,
        );

        expect(component.find("a")).toHaveLength(0);

        component = mount(
            <HelpLinkList helpUrlMap={helpUrlMap} />,
        );

        const anchors = component.find("a");

        expect(anchors).toHaveLength(2);
        expect(anchors.at(0).text()).toEqual("foo >");
        expect(anchors.at(0).key()).toEqual("foo");
        expect(anchors.at(0).prop("href")).toEqual("bar");
        expect(anchors.at(1).text()).toEqual("baz >");
        expect(anchors.at(1).key()).toEqual("baz");
        expect(anchors.at(1).prop("href")).toEqual("qux");

        anchors.forEach((a) => {
            expect(a.prop("tabIndex")).toEqual(0);
            expect(a.prop("target")).toEqual("_blank");
            expect(a.prop("rel")).toEqual("noopener noreferrer");
        });
    });

    it("Test component output (Snapshot)", () => {
        const component = mount(
            <div>
                <HelpLinkList />
                <HelpLinkList helpUrlMap={helpUrlMap} />
            </div>,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });
});
