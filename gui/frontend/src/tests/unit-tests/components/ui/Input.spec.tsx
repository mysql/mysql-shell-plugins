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
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Input } from "../../../../components/ui/Input/Input.js";

describe("Input render testing", (): void => {

    it("Test input callbacks", async () => {
        const onChange = vi.fn();
        const input = render(
            <Input
                id="input1"
                disabled={false}
                password={false}
                value="initial text"
                onChange={onChange}
            >
            </Input>,
        );

        await act(async () => {
            await userEvent.clear(input.getByRole("textbox"));
            await userEvent.type(input.getByRole("textbox"), "new value");
        });

        expect(onChange).toHaveBeenLastCalledWith(
            expect.any(InputEvent),
            expect.objectContaining({
                disabled: false,
                id: "input1",
                password: false,
                spellCheck: true,
                value: "new value",
            }),
        );
    });

    it("Test Input output (Snapshot)", () => {
        const { container } = render(
            <Input id="input2" disabled placeholder="Disabled input" />,
        );
        expect(container).toMatchSnapshot();
    });

});
