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

import { act, render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { Checkbox, CheckState } from "../../../../components/ui/Checkbox/Checkbox.js";

describe("Checkbox component tests", (): void => {
    it("Test checkbox click", async () => {
        const onChange = vi.fn();
        const { container, unmount } = render(
            <Checkbox
                id="cb1"
                checkState={CheckState.Unchecked}
                onChange={onChange}
            >
                Off
            </Checkbox>,
        );

        const chb = container.getElementsByTagName("label")[0];
        expect(chb.childNodes[1].textContent).toEqual("Off");
        expect(chb?.classList.contains("unchecked")).toBeTruthy();

        await act(() => {
            chb?.click();
        });
        expect(onChange).toHaveBeenCalled();

        unmount();
    });

    it("Test checkbox output (Snapshot)", () => {
        const { container, unmount } = render(
            <div>
                <Checkbox id="cb1">
                    Unchecked checkbox
                </Checkbox>
                <Checkbox
                    id="cb2"
                    checkState={CheckState.Indeterminate}
                >
                    Indeterminate checkbox
                </Checkbox>
                <Checkbox id="cb3" checkState={CheckState.Checked}>
                    Checked checkbox
                </Checkbox>
                <Checkbox
                    id="cb4"
                    disabled
                    checkState={CheckState.Indeterminate}
                >
                    Disabled checkbox
                </Checkbox>
            </div>,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });
});
