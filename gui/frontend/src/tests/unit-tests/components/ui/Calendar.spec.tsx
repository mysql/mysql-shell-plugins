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

import { mount } from "enzyme";

import { Calendar } from "../../../../components/ui/Calendar/Calendar.js";

describe("Calendar render testing", (): void => {

    it("Calendar view test properties", () => {
        const currentDate = new Date();
        const component = mount<Calendar>(
            <Calendar
                initialDate={currentDate}
            />,
        );
        expect(component).toBeTruthy();
        const props = component.props();
        expect(props.initialDate).toEqual(currentDate);

        component.unmount();
    });

    it("Test Calendar (Snapshot)", () => {
        const component = mount<Calendar>(
            <Calendar
                initialDate={new Date("2023-05-15T00:00:00.000Z")}
                onChange={(data: Date): void => {
                    const label = document.getElementById("dateValue");
                    if (label) {
                        label.innerText = data.toDateString();
                    }
                }}
            />,
        );
        expect(component).toMatchSnapshot();

        component.unmount();
    });

});
