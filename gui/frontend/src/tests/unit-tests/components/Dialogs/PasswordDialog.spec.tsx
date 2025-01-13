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

import { mount } from "enzyme";

import { IServicePasswordRequest } from "../../../../app-logic/general-types.js";
import { PasswordDialog } from "../../../../components/Dialogs/PasswordDialog.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { changeInputValue, nextProcessTick, sendKeyPress } from "../../test-helpers.js";

describe("Password Dialog Tests", (): void => {
    it("Render Test", () => {
        const component = mount<PasswordDialog>(
            <PasswordDialog />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Show and Cancel Dialog", async () => {
        const component = mount<PasswordDialog>(
            <PasswordDialog />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const request: IServicePasswordRequest = {
            requestId: "123",
            caption: "Enter Password",
            description: ["I need your password"],
            service: "unit tests",
            user: "mike",
            payload: { extra: 123 },
        };

        const promise = component.instance().show(request);

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setTimeout(async () => {
            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);
            expect(portals[0]).toMatchSnapshot();

            sendKeyPress(KeyboardKeys.Escape);
            await nextProcessTick();

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        const password = await promise;
        expect(password).toBeUndefined();

        component.unmount();
    });

    it("Show and Accept Dialog", async () => {
        const component = mount<PasswordDialog>(
            <PasswordDialog />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const request: IServicePasswordRequest = {
            requestId: "123",
            description: ["I need your password"],
            service: "unit tests",
            user: "mike",
            payload: { extra: 123 },
        };

        const promise = component.instance().show(request);

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setTimeout(async () => {
            expect(component.state().password).toBe("");

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);
            expect(portals[0]).toMatchSnapshot();

            const inputs = portals[0].getElementsByTagName("input");
            expect(inputs).toHaveLength(1);
            changeInputValue(inputs[0], "swordfish");
            expect(component.state().password).toBe("swordfish");

            // Close dialog using the enter key in the password field.
            sendKeyPress(KeyboardKeys.Enter, inputs[0]);
            await nextProcessTick();

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        }, 100);

        const password = await promise;
        expect(password).toBe("swordfish");
        component.unmount();
    });
});
