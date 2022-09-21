/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import React from "react";
import { mount } from "enzyme";

import {
    changeInputValue, nextRunLoop, sendKeyPress, setupShellForTests, snapshotFromWrapper, stateChange,
} from "../../test-helpers";
import { LoginPage } from "../../../../components/Login/LoginPage";
import keyboardKey from "keyboard-key";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher";
import { ShellInterface } from "../../../../supplement/ShellInterface";
import { EventType, IDispatchEvent, ListenerEntry } from "../../../../supplement/Dispatch";
import { MessageScheduler } from "../../../../communication";

describe("Login Page Tests", (): void => {
    let launcher: MySQLShellLauncher;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG2");
        expect(MessageScheduler.get.isConnected).toBe(true);
    });

    afterAll(async () => {
        await launcher.exitProcess();
    });

    it("Render Test", () => {
        const component = mount<LoginPage>(
            <LoginPage />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Change User and Password", () => {
        const component = mount<LoginPage>(
            <LoginPage />,
        );

        const edits = component.getDOMNode().getElementsByClassName("input");
        expect(edits).toHaveLength(2);
        expect(edits[0].id).toBe("loginUsername");
        expect(edits[1].id).toBe("loginPassword");

        changeInputValue(edits[0], "mike");
        changeInputValue(edits[1], "swordfish");
        expect(component.state()).toStrictEqual({ errorMessage: "", userName: "mike", password: "swordfish" });

        component.unmount();
    });

    it("Trigger Login", async () => {
        const component = mount<LoginPage>(
            <LoginPage />,
        );

        const authenticateMock = jest.spyOn(ShellInterface.users, "authenticate")
            .mockImplementation((username: string, password: string) => {
                if (username === "mike") {
                    if (password === "swordfish") {
                        const event: IDispatchEvent = {
                            id: "1234",
                            eventType: EventType.FinalResponse,
                            message: "Authentication successful",
                            context: { messageClass: "test" },
                            data: { requestState: { type: "", msg: "" } },
                        };

                        return ListenerEntry.resolve(event);
                    }

                    return ListenerEntry.resolve(new Error("Wrong password"));
                }

                return ListenerEntry.resolve(new Error("User unknown"));
            });

        expect(component.state()).toStrictEqual({ errorMessage: "", userName: "", password: "" });

        const edits = component.getDOMNode().getElementsByClassName("input");
        expect(edits).toHaveLength(2);

        // Wrong user name.
        await stateChange(component, { errorMessage: "", userName: "mike1", password: "swordfish" });

        sendKeyPress(keyboardKey.Enter, edits[0]);
        await nextRunLoop();

        expect(component.state().errorMessage).toBe("User unknown");

        // Wrong password.
        await stateChange(component, { errorMessage: "", userName: "mike", password: "" });

        sendKeyPress(keyboardKey.Enter, edits[0]);
        await nextRunLoop();

        expect(component.state().errorMessage).toBe("Wrong password");

        // Correct login.
        await stateChange(component, { errorMessage: "", userName: "mike", password: "swordfish" });

        sendKeyPress(keyboardKey.Enter, edits[0]);
        await nextRunLoop();

        expect(component.state().errorMessage).toBe("");

        component.unmount();

        authenticateMock.mockRestore();
    });
});
