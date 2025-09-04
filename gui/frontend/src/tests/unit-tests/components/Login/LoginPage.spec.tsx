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

import { act, render } from "@testing-library/preact";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "preact";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { MessageScheduler } from "../../../../communication/MessageScheduler.js";
import { IShellProfile } from "../../../../communication/ProtocolGui.js";
import { ResponseError } from "../../../../communication/ResponseError.js";
import { LoginPage } from "../../../../components/Login/LoginPage.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { changeInputValue, nextRunLoop, sendKeyPress, setupShellForTests } from "../../test-helpers.js";

describe("Login Page Tests", (): void => {
    let launcher: MySQLShellLauncher;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG2");
        expect(MessageScheduler.get.isConnected).toBe(true);
    }, 20000);

    afterAll(async () => {
        await launcher.exitProcess();
    });

    it("Render Test", () => {
        const { container, unmount } = render(
            <LoginPage />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Change User and Password", async () => {
        const pageRef = createRef<LoginPage>();
        const { container, unmount } = render(
            <LoginPage ref={pageRef} />,
        );

        await nextRunLoop();
        expect(pageRef.current).toBeDefined();

        const edits = container.getElementsByClassName("input");
        expect(edits).toHaveLength(2);
        expect(edits[0].id).toBe("loginUsername");
        expect(edits[1].id).toBe("loginPassword");

        changeInputValue(edits[0], "mike");
        changeInputValue(edits[1], "swordfish");

        await nextRunLoop();
        expect(pageRef.current!.state).toStrictEqual({ errorMessage: "", userName: "mike", password: "swordfish" });

        unmount();
    });

    it("Trigger Login", async () => {
        const pageRef = createRef<LoginPage>();
        const { container, unmount } = render(
            <LoginPage ref={pageRef} />,
        );

        await nextRunLoop();
        expect(pageRef.current).toBeDefined();

        const authenticateMock = vi.spyOn(ShellInterface.users, "authenticate")
            .mockImplementation(async (username: string, password: string) => {
                if (username === "mike") {
                    if (password === "swordfish") {
                        const profile: IShellProfile = {
                            id: 1234,
                            userId: 1,
                            name: "root",
                            description: "Me myself and I",
                            options: {},
                        };

                        return Promise.resolve(profile);
                    }

                    return Promise.reject(new ResponseError({ requestState: { msg: "Wrong password" } }));
                }

                return Promise.reject(new ResponseError({ requestState: { msg: "User unknown" } }));
            });

        expect(pageRef.current!.state).toStrictEqual({ errorMessage: "", userName: "", password: "" });

        const edits = container.getElementsByClassName("input");
        expect(edits).toHaveLength(2);

        // Wrong user name.
        await act(() => {
            pageRef.current?.setState({ errorMessage: "", userName: "mike1", password: "swordfish" });
        });
        sendKeyPress(KeyboardKeys.Enter, edits[0]);
        await nextRunLoop();

        expect(pageRef.current?.state.errorMessage).toBe("User unknown");

        // Wrong password.
        await act(() => {
            pageRef.current?.setState({ errorMessage: "", userName: "mike", password: "" });
        });

        (edits[0] as HTMLElement).focus();
        await userEvent.keyboard("{Enter}");
        await nextRunLoop();

        expect(pageRef.current!.state.errorMessage).toBe("Wrong password");

        // Correct login.
        await act(() => {
            pageRef.current?.setState({ errorMessage: "", userName: "mike", password: "swordfish" });
        });

        sendKeyPress(KeyboardKeys.Enter, edits[0]);
        await nextRunLoop();

        expect(pageRef.current!.state.errorMessage).toBe("");

        unmount();

        authenticateMock.mockRestore();
    });
});
