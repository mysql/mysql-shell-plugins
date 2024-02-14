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

import { mount } from "enzyme";

import { nextProcessTick, sendKeyPress } from "../../test-helpers.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { MessagePanel } from "../../../../components/Dialogs/MessagePanel.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";

describe("Message Panel Tests", (): void => {
    it("Render Test", () => {
        const component = mount<MessagePanel>(
            <MessagePanel />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Show Error Panel", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const component = mount<MessagePanel>(
            <MessagePanel />,
        );

        // No values, no dialog.
        await requisitions.execute("showError", []);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        setTimeout(() => {
            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);
            expect(portals[0]).toMatchSnapshot();

            // Close the dialog using the escape key.
            sendKeyPress(KeyboardKeys.Escape);
        }, 1000);

        // The first line in the list is used as caption if there is more than one line.
        await requisitions.execute("showError", ["One line"]);

        setTimeout(() => {
            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);
            expect(portals[0]).toMatchSnapshot();

            // Close the dialog using the close button.
            const buttons = portals[0].getElementsByClassName("button");
            expect(buttons).toHaveLength(2);
            (buttons[1] as HTMLButtonElement).click();
        }, 1000);

        await requisitions.execute("showError", [
            "Caption",
            "Line 1",
            "Line 2",
        ]);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

});
