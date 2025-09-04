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

import { render } from "@testing-library/preact";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CheckState } from "../../../../components/ui/Checkbox/Checkbox.js";
import { Radiobutton } from "../../../../components/ui/Radiobutton/Radiobutton.js";

describe("Radiobutton component tests", (): void => {
    const localEvent = userEvent.setup();

    it("Test Radiobutton output 1", async () => {
        const onClick = vi.fn();
        const { getByText, unmount } = render(
            <Radiobutton id="rb1" onClick={onClick} name="rb">
                Unchecked radiobutton
            </Radiobutton>,
        );

        const radioLabel = getByText("Unchecked radiobutton");
        expect(radioLabel).toBeTruthy();
        expect(radioLabel.textContent).toEqual("Unchecked radiobutton");
        expect(onClick).not.toHaveBeenCalled();
        await localEvent.click(radioLabel);
        expect(onClick).toHaveBeenCalled();

        unmount();
    });

    it("Test Radiobutton output (snapshot)", () => {
        const { container, unmount } = render(
            <Radiobutton
                id="rb4"
                name="rbx"
                disabled
                checkState={CheckState.Checked}
                caption="Disabled Radiobutton"
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Radiobutton interaction", async () => {
        const { getByRole, unmount } = render(
            <Radiobutton
                id="rb4"
                name="rbx"
                disabled
                checkState={CheckState.Checked}
                caption="Disabled Radiobutton"
            />,
        );

        const button = getByRole("radio", { name: "Disabled Radiobutton" });
        expect(button).not.toBeNull();
        button.focus();

        await userEvent.keyboard("[Space]");

        unmount();
    });
});
