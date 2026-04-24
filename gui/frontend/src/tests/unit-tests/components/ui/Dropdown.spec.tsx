/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import { fireEvent, render, waitFor } from "@testing-library/preact";
import { describe, expect, it } from "vitest";

import { Codicon } from "../../../../components/ui/Codicon.js";
import { Dropdown, DropdownVariant } from "../../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../../../components/ui/Icon/Icon.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("Dropdown render testing", (): void => {

    it("Standard Rendering", () => {
        const { container, unmount } = render(
            <Dropdown selection="tesla" optional={false} style={{ maxWidth: "300px" }}>
                <DropdownItem id="tesla" caption="Tesla" />
                <DropdownItem id="volvo" caption="Volvo" />
                <DropdownItem id="bmw" caption="BMW" />
                <DropdownItem id="renault" caption="Renault" />
            </Dropdown>,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("renders the selected item picture in the closed control", () => {
        const { container, unmount } = render(
            <Dropdown selection="home" optional={false}>
                <DropdownItem id="home" caption="Home" picture={<Icon src={Codicon.Home} />} />
                <DropdownItem id="general" caption="General" picture={<Icon src={Codicon.Gear} />} />
            </Dropdown>,
        );

        expect(container.querySelector(".codicon-home")).toBeTruthy();
        expect(container.textContent).toContain("Home");

        unmount();
    });

    it("applies the airy variant classes to the closed control and popup list", async () => {
        const { container, unmount } = render(
            <Dropdown selection="tesla" optional={false} variant={DropdownVariant.AiryDropdown}>
                <DropdownItem id="tesla" caption="Tesla" />
                <DropdownItem id="volvo" caption="Volvo" />
            </Dropdown>,
        );

        const control = container.querySelector(".dropdown");
        expect(control?.classList.contains("airyDropdown")).toBe(true);

        fireEvent.click(control!);
        await nextRunLoop();

        await waitFor(() => {
            const popup = document.body.querySelector(".popup.dropdownList.airyDropdown");
            expect(popup).toBeTruthy();
        });

        unmount();
    });

});
