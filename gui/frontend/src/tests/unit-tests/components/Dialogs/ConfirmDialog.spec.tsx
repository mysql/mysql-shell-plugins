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

import { describe, expect, it, vi } from "vitest";

import { Label } from "../../../../components/ui/Label/Label.js";

import { render } from "@testing-library/preact";
import { createRef } from "preact";
import { DialogResponseClosure } from "../../../../app-logic/general-types.js";
import { ConfirmDialog } from "../../../../components/Dialogs/ConfirmDialog.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { nextProcessTick, sendKeyPress } from "../../test-helpers.js";

describe("Confirm Dialog Tests", (): void => {

    it("Confirm Dialog Render Test", () => {
        const { container, unmount } = render(
            <ConfirmDialog />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Show Dialog with simple and no message", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const dialogRef = createRef<ConfirmDialog>();
        const { unmount } = render(
            <ConfirmDialog ref={dialogRef} />,
        );

        await nextProcessTick();
        expect(dialogRef.current).toBeDefined();

        dialogRef.current!.show("Answer The Question", {
            refuse: "No, I'm not a spy",
            accept: "Yes, you got me",
        }, "Confirm you are a spy!", undefined, { brain: "Lorem Ipsum" },
        );
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();
        sendKeyPress(KeyboardKeys.Escape);

        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        dialogRef.current!.show("", { refuse: "No, I'm not a spy", accept: "Yes, you got me" },
            "Resistance is futile", undefined, { brain: "Lorem Ipsum" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();
        sendKeyPress(KeyboardKeys.Escape);

        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        unmount();
    });

    it("Show Dialog with React Element", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const dialogRef = createRef<ConfirmDialog>();
        const { unmount } = render(
            <ConfirmDialog ref={dialogRef} />,
        );

        await nextProcessTick();
        expect(dialogRef.current).toBeDefined();

        const label = <Label>Time to say goodbye</Label>;
        dialogRef.current!.show(label, { refuse: "No, I'm not a spy", accept: "Yes, you got me" },
            "Confirm you are a spy!", undefined, { brain: "Lorem Ipsum" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();
        sendKeyPress(KeyboardKeys.Escape);

        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        unmount();
    });

    it("Test Buttons", async () => {
        const spyOnClose = vi.fn((_closure: DialogResponseClosure, _payload?: unknown): void => {
            // no-op
        });

        const dialogRef = createRef<ConfirmDialog>();
        const { unmount } = render(
            <ConfirmDialog ref={dialogRef} onClose={spyOnClose} />,
        );

        await nextProcessTick();
        expect(dialogRef.current).toBeDefined();

        // First round: accept.
        dialogRef.current!.show("Answer The Question", { refuse: "No, I'm not a spy", accept: "Yes, you got me" },
            "Confirm you are a spy!", undefined, { brain: "Lorem Ipsum" });
        await nextProcessTick();

        // Dialogs are rendered using portals, so we cannot use the component to interact with them.
        let portals = document.getElementsByClassName("portal");
        let buttons = portals[0].getElementsByClassName("button");

        expect(buttons).toHaveLength(3);
        expect(buttons[0].id).toBe("closeButton");
        expect(buttons[1].id).toBe("accept");

        (buttons[1] as HTMLButtonElement).click();
        expect(spyOnClose).toHaveBeenCalledTimes(1);
        expect(spyOnClose).toHaveBeenCalledWith(DialogResponseClosure.Accept, { brain: "Lorem Ipsum" });

        // Check the dialog was closed.
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        // Second round: deny.
        dialogRef.current!.show("Answer The Question", { refuse: "No, I'm not a spy", accept: "Yes, you got me" },
            "Resistance is futile", undefined, { brain: "Dolor Sit" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        buttons = portals[0].getElementsByClassName("button");

        expect(buttons).toHaveLength(3);
        expect(buttons[0].id).toBe("closeButton");
        expect(buttons[1].id).toBe("accept");

        (buttons[2] as HTMLButtonElement).click();
        expect(spyOnClose).toHaveBeenCalledTimes(2);
        expect(spyOnClose).toHaveBeenCalledWith(DialogResponseClosure.Decline, { brain: "Dolor Sit" });

        // Check the dialog was closed.
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        unmount();
    });
});
