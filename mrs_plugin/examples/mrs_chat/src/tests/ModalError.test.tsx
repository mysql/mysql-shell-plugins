/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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
import { describe, it, expect } from "vitest";
import { mount } from "enzyme";

import ModalError from "../components/ModalError";

if (import.meta.vitest !== undefined) {
    describe("ModalError", () => {
        const f = (): void => { /**/ };
        const e = new Error("Test-Error");

        it("should display error message", () => {
            const wrapper = mount(<ModalError error={e} resetError={f} logout={f} />);
            expect(wrapper.text()).to.include("Test-Error");
        });

        /*it("should render a button", () => {
            const wrapper = mount(<Counter initialCount={5} />);

            expect(
                wrapper.find("button").matchesElement(<button>Increment</button>),
            ).to.equal(true);
        });

        it('should increment after "Increment" button is clicked', () => {
            const wrapper = mount(<Counter initialCount={5} />);

            wrapper.find("button").simulate("click");

            expect(wrapper.text()).to.include("Current value: 6");
        });*/
    });
}
