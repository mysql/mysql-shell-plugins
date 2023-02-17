/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
import keyboardKey from "keyboard-key";

import { nextProcessTick, sendKeyPress } from "../../test-helpers";
import { requisitions } from "../../../../supplement/Requisitions";
import { ErrorPanel } from "../../../../components/Dialogs/ErrorPanel";

describe("Error Panel Tests", (): void => {
    it("Render Test", () => {
        const component = mount<ErrorPanel>(
            <ErrorPanel />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Show Panel", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const component = mount<ErrorPanel>(
            <ErrorPanel />,
        );

        // No values, no dialog.
        await requisitions.execute("showError", []);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        // The first line in the list is used as caption if there are more than one line.
        await requisitions.execute("showError", ["One line"]);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
        expect(portals[0]).toMatchSnapshot();

        // Close the dialog using the escape key.
        sendKeyPress(keyboardKey.Escape);

        await requisitions.execute("showError", [
            "Caption",
            "Line 1",
            "Line 2",
        ]);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
        expect(portals[0]).toMatchSnapshot();

        // Close the dialog using the close button.
        const buttons = portals[0].getElementsByClassName("button");
        expect(buttons).toHaveLength(2);
        (buttons[1] as HTMLButtonElement).click();
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

});
