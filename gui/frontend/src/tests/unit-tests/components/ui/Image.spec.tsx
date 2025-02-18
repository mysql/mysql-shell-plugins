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

import { mount } from "enzyme";

import { Image } from "../../../../components/ui/Image/Image.js";
import { Assets } from "../../../../supplement/Assets.js";

describe("Image component tests", (): void => {

    it("Test Image elements", () => {
        const component = mount<Image>(
            <Image id="image1" src={Assets.misc.closeIcon} alt="image alt description" style={{ height: "64px" }} />,
        );
        expect(component).toBeTruthy();
        const props = component.props();
        expect(props.id).toEqual("image1");
        expect(props.alt).toEqual("image alt description");
        expect(props.src).toEqual("close.svg");
    });


    it("Standard Rendering", () => {
        const component = mount<Image>(
            <Image src={Assets.misc.closeIcon} style={{ height: "64px" }} />,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

});
