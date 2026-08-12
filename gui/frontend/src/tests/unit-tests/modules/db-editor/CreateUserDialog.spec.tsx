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

import { fireEvent, render } from "@testing-library/preact";
import { createRef } from "preact";
import { describe, expect, it, vi } from "vitest";

import { CommonDialogValueOption, ValueEditDialog } from "../../../../components/Dialogs/ValueEditDialog.js";
import { DialogResponseClosure } from "../../../../app-logic/general-types.js";
import { CreateUserDialog } from "../../../../modules/db-editor/CreateUserDialog.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { nextProcessTick, nextRunLoop, sendKeyPress } from "../../test-helpers.js";

describe("CreateUserDialog", () => {
    it.each(["first", "second", "third"] as const)(
        "preserves credentials when reselecting the %s plugin", async (factor) => {
            const values = CreateUserDialog.createDialogValues(["authentication_pam"]);
            CreateUserDialog.enableMfa(values);
            const authentication = values.sections.get("authentication")!.values;
            const pluginKey = factor === "first" ? "authenticationPlugin" : `${factor}AuthenticationPlugin`;
            const credentialKey = factor === "first" ? "authenticationString" : `${factor}AuthenticationString`;
            authentication[pluginKey].value = "authentication_pam";
            authentication[credentialKey].value = "mysql-unix";
            authentication.password.value = "secret";
            authentication.passwordConfirmation.value = "secret";
            const dialogRef = createRef<ValueEditDialog>();
            const { unmount } = render(<CreateUserDialog dialogRef={dialogRef} />);
            dialogRef.current!.show(values);
            await nextProcessTick();
            const dialog = dialogRef.current! as unknown as {
                handleChoiceChange: (section: string, accept: boolean, selected: Set<string>, key: string) => void;
            };

            dialog.handleChoiceChange("authentication", true, new Set(["authentication_pam"]), pluginKey);

            expect(authentication[credentialKey].value).toBe("mysql-unix");
            expect(authentication.password.value).toBe("secret");
            expect(authentication.passwordConfirmation.value).toBe("secret");
            unmount();
        },
    );

    it.each(["first", "second", "third"] as const)(
        "clears credentials when changing the %s authentication plugin", (factor) => {
            const values = CreateUserDialog.createDialogValues(["authentication_pam", "auth_socket"]);
            CreateUserDialog.enableMfa(values);
            const authentication = values.sections.get("authentication")!.values;
            const credentialKey = factor === "first" ? "authenticationString" : `${factor}AuthenticationString`;
            authentication[credentialKey].value = "mysql-unix";
            authentication.password.value = "secret";
            authentication.passwordConfirmation.value = "secret";
            const dialog = {
                getDialogValues: () => {
                    return values;
                },
                setDialogValues: vi.fn(),
            } as unknown as ValueEditDialog;

            CreateUserDialog.updateFactorInputs(factor, "auth_socket", dialog);

            expect(authentication[credentialKey].value).toBe("");
            if (factor === "first") {
                expect(authentication.password.value).toBe("");
                expect(authentication.passwordConfirmation.value).toBe("");
            }
        },
    );

    it("preserves saved authentication strings while prefilling an account", () => {
        const values = CreateUserDialog.createDialogValues(["authentication_pam"]);
        const authentication = values.sections.get("authentication")!.values;
        authentication.authenticationString.value = "mysql-unix";

        CreateUserDialog.updateFactorInputs("first", "authentication_pam", undefined, values);

        expect(authentication.authenticationString.value).toBe("mysql-unix");
    });

    it("renders default dialog shell (snapshot)", () => {
        const dialogRef = createRef<ValueEditDialog>();
        const { container, unmount } = render(
            <CreateUserDialog dialogRef={dialogRef} />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("shows the dialog with default values (snapshot)", async () => {
        const dialogRef = createRef<ValueEditDialog>();
        const { unmount } = render(
            <CreateUserDialog dialogRef={dialogRef} />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        dialogRef.current!.show(
            CreateUserDialog.createDialogValues(),
            { title: "Create User Account" },
        );
        await nextProcessTick();

        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);
        expect(portals[0]).toMatchSnapshot();

        fireEvent.click(portals[0].querySelector("#page3")!);

        const passwordManagement = portals[0].querySelector<HTMLDetailsElement>("details.collapsibleValueGroup");
        expect(passwordManagement?.open).toBe(true);
        expect(passwordManagement?.querySelector("#passwordExpiration")).not.toBeNull();
        expect(passwordManagement?.querySelector("#passwordHistory")).not.toBeNull();
        expect(passwordManagement?.querySelector("#passwordReuseInterval")).not.toBeNull();
        expect(passwordManagement?.querySelector("#failedPasswordAttempts")).not.toBeNull();
        expect(passwordManagement?.querySelector("#lockAccount")).not.toBeNull();

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();

        unmount();
    });

    it("uses Apply when editing a user", async () => {
        const dialogRef = createRef<ValueEditDialog>();
        const { unmount } = render(
            <CreateUserDialog dialogRef={dialogRef} editing />,
        );

        await nextRunLoop();
        dialogRef.current!.show(CreateUserDialog.createDialogValues(), { title: "Edit User Account" });
        await nextProcessTick();

        expect(document.querySelector<HTMLButtonElement>("#ok")?.textContent).toBe("Apply");

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();
        unmount();
    });

    it("enables three-factor authentication", async () => {
        const dialogRef = createRef<ValueEditDialog>();
        const { unmount } = render(<CreateUserDialog dialogRef={dialogRef} />);

        await nextRunLoop();
        dialogRef.current!.show(CreateUserDialog.createDialogValues([
            "caching_sha2_password", "authentication_webauthn", "auth_socket",
        ]), { title: "Create User Account" });
        await nextProcessTick();

        const portal = document.getElementsByClassName("portal")[0];
        fireEvent.click(portal.querySelector("#advanced-btn")!);

        const values = dialogRef.current!.getDialogValues().sections.get("authentication")!.values;
        expect(portal.querySelectorAll("summary")).toHaveLength(3);
        expect(portal.querySelectorAll("summary")[0].textContent).toBe("1st Factor");
        expect(portal.querySelectorAll("summary")[1].textContent).toBe("2nd Factor");
        expect(portal.querySelectorAll("summary")[2].textContent).toBe("3rd Factor");
        expect(values.secondAuthenticationPlugin.choices)
            .toEqual(["None", "authentication_webauthn", "auth_socket"]);
        expect(values.thirdAuthenticationPlugin.choices)
            .toEqual(["None", "authentication_webauthn", "auth_socket"]);
        expect(values.secondAuthenticationString.options).toContain(CommonDialogValueOption.Hidden);
        expect(portal.querySelector("#advanced-btn")?.classList.contains("disabled")).toBe(true);

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();
        unmount();
    });

    it("keeps additional authentication factors contiguous", () => {
        const values = CreateUserDialog.createDialogValues([
            "caching_sha2_password", "authentication_pam", "authentication_kerberos",
        ]);
        CreateUserDialog.enableMfa(values);
        const authentication = values.sections.get("authentication")!.values;
        authentication.secondAuthenticationPlugin.value = "None";
        authentication.secondAuthenticationString.value = "";
        authentication.thirdAuthenticationPlugin.value = "authentication_pam";
        authentication.thirdAuthenticationString.value = "mysql-unix";

        CreateUserDialog.updateFactorInputs("second", "None", undefined, values);

        expect(authentication.secondAuthenticationPlugin.value).toBe("authentication_pam");
        expect(authentication.secondAuthenticationString.value).toBe("mysql-unix");
        expect(authentication.thirdAuthenticationPlugin.value).toBe("None");
        expect(authentication.thirdAuthenticationString.value).toBe("");
    });

    it("preserves the primary authentication string when enabling MFA", () => {
        const values = CreateUserDialog.createDialogValues(["authentication_pam"]);
        const authentication = values.sections.get("authentication")!.values;
        authentication.authenticationString.value = "mysql-unix";

        CreateUserDialog.enableMfa(values);

        expect(authentication.authenticationString.value).toBe("mysql-unix");
    });

    it("clears random password when switching to external authentication", () => {
        const values = CreateUserDialog.createDialogValues(["caching_sha2_password", "authentication_pam"]);
        const authentication = values.sections.get("authentication")!.values;
        authentication.randomPassword.value = true;

        CreateUserDialog.updateFactorInputs("first", "authentication_pam", undefined, values);

        expect(authentication.randomPassword.value).toBe(false);
        expect(authentication.randomPassword.options).toContain(CommonDialogValueOption.Hidden);
    });

    it("shows plugin documentation and WebAuthn registration guidance", () => {
        const values = CreateUserDialog.createDialogValues(["authentication_webauthn"]);
        CreateUserDialog.updateFactorInputs("first", "authentication_webauthn", undefined, values);

        const authentication = values.sections.get("authentication")!.values;
        expect(authentication.authenticationPlugin).toMatchObject({
            trailingLink: {
                url: "https://dev.mysql.com/doc/refman/en/webauthn-pluggable-authentication.html",
                caption: "Use a FIDO2/WebAuthn hardware security key or other method.",
            },
        });
        expect(authentication.authenticationGuidance).toMatchObject({
            type: "description",
            value: "After creating this account, register a WebAuthn device with a WebAuthn-capable client.",
        });
    });

    it("keeps entered values open when acceptance reports a backend error", async () => {
        const dialogRef = createRef<ValueEditDialog>();
        const onClose = vi.fn().mockResolvedValue(false);
        const { unmount } = render(
            <CreateUserDialog dialogRef={dialogRef} onClose={onClose} />,
        );
        const values = CreateUserDialog.createDialogValues();
        values.sections.get("general")!.values.userName.value = "retryUser";

        await nextRunLoop();
        dialogRef.current!.show(values, { title: "Create User Account" });
        await nextProcessTick();

        const portal = document.getElementsByClassName("portal")[0];
        const ok = portal.querySelector<HTMLButtonElement>("#ok");
        ok!.click();
        await nextProcessTick();

        expect(onClose).toHaveBeenCalledWith(DialogResponseClosure.Accept, values, undefined);
        expect(document.getElementsByClassName("portal")).toHaveLength(1);
        expect(dialogRef.current!.state.values.sections.get("general")!.values.userName.value).toBe("retryUser");

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();
        unmount();
    });

    it("enables OK when reopened after successfully creating a user", async () => {
        const dialogRef = createRef<ValueEditDialog>();
        const onClose = vi.fn().mockResolvedValue(true);
        const { unmount } = render(
            <CreateUserDialog dialogRef={dialogRef} onClose={onClose} />,
        );
        const values = CreateUserDialog.createDialogValues();
        values.sections.get("general")!.values.userName.value = "createdUser";

        await nextRunLoop();
        dialogRef.current!.show(values, { title: "Create User Account" });
        await nextProcessTick();

        document.querySelector<HTMLButtonElement>("#ok")!.click();
        await nextRunLoop();
        expect(document.getElementsByClassName("portal")).toHaveLength(0);

        dialogRef.current!.show(CreateUserDialog.createDialogValues(), { title: "Create User Account" });
        await nextProcessTick();

        expect(document.querySelector("#ok")?.classList.contains("disabled")).toBe(false);

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();
        unmount();
    });

    it("createDialogValues exposes expected defaults", () => {
        const values = CreateUserDialog.createDialogValues();
        expect(values.id).toBe("createUser");
        expect(values.sections.size).toBe(5);

        const general = values.sections.get("general");
        const authentication = values.sections.get("authentication");
        const advanced = values.sections.get("advanced");
        const tls = values.sections.get("tls");
        const resourceLimits = values.sections.get("resourceLimits");

        expect(general?.values.userName.value).toBe("");
        expect(general?.values.hostName.value).toBe("%");
        expect(general?.values.lockAccount.value).toBe(false);

        expect(authentication?.values.authenticationPlugin.value).toBe("caching_sha2_password");
        expect(authentication?.values.passwordExpire.value).toBe(false);
        expect(authentication?.values.randomPassword.value).toBe(false);
        expect(authentication?.values.password.value).toBe("");
        expect(authentication?.values.passwordConfirmation.value).toBe("");
        expect(advanced?.values.passwordManagement).toMatchObject({
            type: "separator",
            caption: "Password Management",
            collapsible: true,
            expanded: true,
        });
        expect(advanced?.values.passwordExpiration.value).toBe(0);
        expect(advanced?.values.passwordHistory.value).toBe(0);
        expect(advanced?.values.passwordReuseInterval.value).toBe(0);
        expect(advanced?.values.failedPasswordAttempts.value).toBe(0);
        expect(advanced?.values.lockAccount.value).toBe(false);

        expect(tls?.values.tlsMode.value).toMatchObject({ tlsMode: "None" });
        expect(tls?.values.tlsCipher.value).toBe("");
        expect(tls?.values.tlsIssuer.value).toBe("");
        expect(tls?.values.tlsSubject.value).toBe("");

        expect(resourceLimits?.values.maxQueriesPerHour.value).toBe(0);
        expect(resourceLimits?.values.maxQueriesPerHour.description)
            .toBe("Maximum queries allowed per hour (0 - no limitation).");
        expect(resourceLimits?.values.maxConnectionsPerHour.value).toBe(0);
        expect(resourceLimits?.values.maxConnectionsPerHour.description)
            .toBe("Maximum connections allowed per hour (0 - no limitation).");
        expect(resourceLimits?.values.maxUpdatesPerHour.value).toBe(0);
        expect(resourceLimits?.values.maxUpdatesPerHour.description)
            .toBe("Maximum updates allowed per hour (0 - no limitation).");
        expect(resourceLimits?.values.maxUserConnections.value).toBe(0);
        expect(resourceLimits?.values.maxUserConnections.description)
            .toBe("Maximum concurrent connections for this account (0 - no limitation).");
    });

    it("disables password fields when generating a random password", async () => {
        const dialogRef = createRef<ValueEditDialog>();
        const { unmount } = render(<CreateUserDialog dialogRef={dialogRef} />);

        await nextRunLoop();
        dialogRef.current!.show(CreateUserDialog.createDialogValues(), { title: "Create User Account" });
        await nextProcessTick();

        const randomPassword = document.querySelector<HTMLInputElement>("#randomPassword")!;
        fireEvent.click(randomPassword);

        expect(document.querySelector<HTMLInputElement>("#password")?.disabled).toBe(true);
        expect(document.querySelector<HTMLInputElement>("#passwordConfirmation")?.disabled).toBe(true);

        fireEvent.click(randomPassword);
        expect(document.querySelector<HTMLInputElement>("#password")?.disabled).toBe(false);
        expect(document.querySelector<HTMLInputElement>("#passwordConfirmation")?.disabled).toBe(false);

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();
        unmount();
    });
});
