/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { render, waitFor } from "@testing-library/preact";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "preact";
import { describe, expect, it, vi } from "vitest";

import { PasswordChangeDialog } from "../../../../components/Dialogs/PasswordChangeDialog.js";

describe("Password Change Dialog Tests", (): void => {
    it("returns a confirmed new password", async () => {
        const dialogRef = createRef<PasswordChangeDialog>();
        const { unmount } = render(<PasswordChangeDialog ref={dialogRef} />);

        const result = dialogRef.current!.show({ requestId: "password-change" });
        await waitFor(() => {
            expect(document.querySelector("#newPassword")).toBeTruthy();
        });
        expect(document.querySelector("#currentPassword")).toBeNull();

        await userEvent.type(document.querySelector<HTMLInputElement>("#newPassword")!, "swordfish");
        await userEvent.type(document.querySelector<HTMLInputElement>("#passwordConfirmation")!, "swordfish");
        await userEvent.click(document.querySelector<HTMLButtonElement>("#ok")!);

        expect(await result).toEqual({ password: "swordfish" });
        unmount();
    });

    it("shows and returns the current password when required", async () => {
        const dialogRef = createRef<PasswordChangeDialog>();
        const onAccept = vi.fn();
        const { unmount } = render(<PasswordChangeDialog ref={dialogRef} />);

        const result = dialogRef.current!.show({
            requestId: "password-change",
            requireCurrentPassword: true,
            onAccept,
        });
        await waitFor(() => {
            expect(document.querySelector("#currentPassword")).toBeTruthy();
        });

        await userEvent.type(document.querySelector<HTMLInputElement>("#currentPassword")!, "old-password");
        await userEvent.type(document.querySelector<HTMLInputElement>("#newPassword")!, "new-password");
        await userEvent.type(document.querySelector<HTMLInputElement>("#passwordConfirmation")!, "new-password");
        await userEvent.click(document.querySelector<HTMLButtonElement>("#ok")!);

        const values = { currentPassword: "old-password", password: "new-password" };
        expect(onAccept).toHaveBeenCalledWith(values);
        expect(await result).toEqual(values);
        unmount();
    });

    it("prevents duplicate submissions while accepting", async () => {
        let resolveAccept!: () => void;
        const onAccept = vi.fn(() => {
            return new Promise<void>((resolve) => {
                resolveAccept = resolve;
            });
        });
        const dialogRef = createRef<PasswordChangeDialog>();
        const { unmount } = render(<PasswordChangeDialog ref={dialogRef} />);

        const result = dialogRef.current!.show({ requestId: "password-change", onAccept });
        await waitFor(() => {
            expect(document.querySelector("#newPassword")).toBeTruthy();
        });

        const password = document.querySelector<HTMLInputElement>("#newPassword")!;
        const confirmation = document.querySelector<HTMLInputElement>("#passwordConfirmation")!;
        await userEvent.type(password, "swordfish");
        await userEvent.type(confirmation, "swordfish");
        await userEvent.click(document.querySelector<HTMLButtonElement>("#ok")!);

        expect(onAccept).toHaveBeenCalledOnce();
        expect(document.querySelector("#ok")?.classList).toContain("disabled");
        confirmation.focus();
        await userEvent.keyboard("{Enter}");
        expect(onAccept).toHaveBeenCalledOnce();

        resolveAccept();
        expect(await result).toEqual({ password: "swordfish" });
        unmount();
    });
});
