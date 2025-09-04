/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { Slider } from "../../../../components/ui/Slider/Slider.js";
import { createRef } from "preact";

describe("Slider component tests", (): void => {

    it("Standard Rendering", () => {
        const { container, unmount } = render(
            <Slider
                id="slider1"
                value={0.3}
            />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Value Change", () => {
        const onChange = vi.fn();

        const sliderRef = createRef<Slider>();
        const { container, unmount } = render(
            <Slider
                ref={sliderRef}
                id="slider1"
                value={0.3}
                onChange={onChange}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(sliderRef.current).toBeDefined();

        sliderRef.current!.value = 0.8;
        expect(onChange).toBeCalledWith(0.8);

        unmount();
    });

});
