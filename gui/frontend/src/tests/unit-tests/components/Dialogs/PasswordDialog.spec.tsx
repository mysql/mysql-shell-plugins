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

import { act, render, waitFor } from "@testing-library/preact";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "preact";
import { describe, expect, it } from "vitest";

import { IServicePasswordRequest } from "../../../../app-logic/general-types.js";
import { PasswordDialog } from "../../../../components/Dialogs/PasswordDialog.js";
import { nextProcessTick } from "../../test-helpers.js";

describe("Password Dialog Tests", (): void => {
    it("Render Test", () => {
        const { container, unmount } = render(
            <PasswordDialog />,
        );

        expect(container).toMatchSnapshot();
        unmount();
    });

    it("Show and Cancel Dialog", async () => {
        const dialogRef = createRef<PasswordDialog>();
        const { unmount } = render(
            <PasswordDialog ref={dialogRef} />,
        );

        await nextProcessTick();
        expect(dialogRef.current).toBeDefined();

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

        const promise = dialogRef.current!.show(request);

        // Wait until the dialog is rendered.
        await waitFor(() => {
            expect(document.getElementsByClassName("portal").length).toBe(1);
        });
        portals = document.getElementsByClassName("portal");
        expect(portals[0]).toMatchSnapshot();

        await userEvent.keyboard("{Escape}");

        // And wait until the dialog is closed.
        await waitFor(() => {
            expect(document.getElementsByClassName("portal").length).toBe(0);
        });

        const password = await promise;
        expect(password).toBeUndefined();

        unmount();
    });

    it("Show and Accept Dialog", async () => {
        const dialogRef = createRef<PasswordDialog>();
        const { unmount } = render(
            <PasswordDialog ref={dialogRef} />,
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

        await nextProcessTick();
        expect(dialogRef.current).toBeDefined();

        const promise = dialogRef.current!.show(request);

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setTimeout(async () => {
            expect(dialogRef.current!.state.password).toBe("");

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);
            expect(portals[0]).toMatchSnapshot();

            const inputs = portals[0].getElementsByTagName("input");
            expect(inputs).toHaveLength(1);
            await userEvent.type(inputs[0], "swordfish");
            await act(() => {
                expect(dialogRef.current!.state.password).toBe("swordfish");
            });

            // Close dialog using the enter key in the password field.
            await userEvent.keyboard("{Enter}");
            await nextProcessTick();

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        }, 100);

        const password = await promise;
        expect(password).toBe("swordfish");
        unmount();
    });
});
