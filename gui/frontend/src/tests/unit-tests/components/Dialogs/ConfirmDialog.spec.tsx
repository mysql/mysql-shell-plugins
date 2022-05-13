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
import keyboardKey from "keyboard-key";

import { ConfirmDialog } from "../../../../components/Dialogs";
import { Label } from "../../../../components/ui";

import { nextProcessTick, sendKeyPress, snapshotFromWrapper } from "../../test-helpers";

describe("Confirm Dialog Tests", (): void => {

    it("Confirm Dialog Render Test", () => {
        const component = mount<ConfirmDialog>(
            <ConfirmDialog caption="Confirm you are a spy!" />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Show Dialog with simple and no message", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const component = mount<ConfirmDialog>(
            <ConfirmDialog caption="Confirm you are a spy!" />,
        );

        component.instance().show("Answer The Question", "No, I'm no spy", "Yes, you got me", { brain: "Lorem Ipsum" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();
        sendKeyPress(keyboardKey.Escape);

        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.instance().show("", "No, I'm no spy", "Yes, you got me", { brain: "Lorem Ipsum" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();
        sendKeyPress(keyboardKey.Escape);

        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

    it("Show Dialog with React Element", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const component = mount<ConfirmDialog>(
            <ConfirmDialog caption="Confirm you are a spy!" />,
        );

        const label = <Label>Time to say goodbye</Label>;
        component.instance().show(label, "No, I'm no spy", "Yes, you got me", { brain: "Lorem Ipsum" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();
        sendKeyPress(keyboardKey.Escape);

        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

    it("Test Buttons", async () => {
        const spyOnClose = jest.fn((_accepted: boolean, _payload?: unknown): void => {
            // no-op
        });

        const component = mount<ConfirmDialog>(
            <ConfirmDialog
                caption="Confirm you are a spy!"
                onClose={spyOnClose}
            />,
        );

        // First round: accept.
        component.instance().show("Answer The Question", "No, I'm no spy", "Yes, you got me", { brain: "Lorem Ipsum" });
        await nextProcessTick();

        // Dialogs are rendered using portals, so we cannot use the component to interact with them.
        let portals = document.getElementsByClassName("portal");
        let buttons = portals[0].getElementsByClassName("button");

        expect(buttons).toHaveLength(2);
        expect(buttons[0].id).toBe("accept");
        expect(buttons[1].id).toBe("refuse");

        (buttons[0] as HTMLButtonElement).click();
        expect(spyOnClose).toHaveBeenCalledTimes(1);
        expect(spyOnClose).toHaveBeenCalledWith(true, { brain: "Lorem Ipsum" });

        // Check the dialog was closed.
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        // Second round: deny.
        component.instance().show("Answer The Question", "No, I'm no spy", "Yes, you got me", { brain: "Dolor Sit" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        buttons = portals[0].getElementsByClassName("button");

        expect(buttons).toHaveLength(2);
        expect(buttons[0].id).toBe("accept");
        expect(buttons[1].id).toBe("refuse");

        (buttons[1] as HTMLButtonElement).click();
        expect(spyOnClose).toHaveBeenCalledTimes(2);
        expect(spyOnClose).toHaveBeenCalledWith(false, { brain: "Dolor Sit" });

        // Check the dialog was closed.
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });
});