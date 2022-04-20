/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
import { ITagInputProperties, Orientation, TagInput } from "../../../../components/ui";
import { snapshotFromWrapper } from "../../test-helpers";


describe("TagInput testing", () => {

    it("TagInput test properties", () => {
        const component = mount(
            <TagInput
                tags={[ { id: "1", caption: "tag 1" }, { id: "2", caption: "tag 2" }]}
                removable={false}
                orientation={Orientation.BottomUp}
            />,
        );
        expect(component).toBeTruthy();
        const props = component.props() as ITagInputProperties;
        expect(props.tags).toEqual([{ id: "1", caption: "tag 1" }, { id: "2", caption: "tag 2" }]);
        expect(props.removable).toEqual(false);
        expect(props.orientation).toEqual(Orientation.BottomUp);
    });

    it("Render test", () => {
        const component = mount(
            <TagInput
                tags={[ { id: "1", caption: "tag 1" }, { id: "2", caption: "tag 2" }]}
                removable={false}
                orientation={Orientation.BottomUp}
            />,
        );
        expect (snapshotFromWrapper(component)).toMatchSnapshot();
        component.unmount();
    });

});
