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

import { changeInputValue, nextProcessTick, sendKeyPress } from "../../test-helpers";
import { ParamDialog } from "../../../../components/Dialogs/ParamDialog";
import { KeyboardKeys } from "../../../../utilities/helpers";

describe("Param Dialog Tests", (): void => {
    it("Render Test", () => {
        const component = mount<ParamDialog>(
            <ParamDialog
                caption="Lorem Ipsum"
            />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Show Panel and Escape", async () => {
        const spyOnClose = jest.fn((_accepted: boolean, _payload?: unknown): void => {
            // no-op
        });

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const component = mount<ParamDialog>(
            <ParamDialog
                caption="Dolor Sit Amet"
                onClose={spyOnClose}
            />,
        );

        component.instance().show();
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
        expect(portals[0]).toMatchSnapshot();

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
        expect(spyOnClose).toHaveBeenCalledTimes(1);
        expect(spyOnClose).toHaveBeenCalledWith(true, { name: "", value: "" });

        component.unmount();
    });

    it("Show Panel and Escape", async () => {
        const spyOnClose = jest.fn((_accepted: boolean, _payload?: unknown): void => {
            // no-op
        });

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const component = mount<ParamDialog>(
            <ParamDialog
                onClose={spyOnClose}
            />,
        );

        component.instance().show();
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
        expect(portals[0]).toMatchSnapshot();
        expect(component.state()).toStrictEqual({ name: "", value: "" });

        const inputs = portals[0].getElementsByClassName("input");
        expect(inputs).toHaveLength(2);
        expect(inputs[0].id).toBe("name");
        expect(inputs[1].id).toBe("value");

        changeInputValue(inputs[0], "ABC");
        await nextProcessTick();
        expect(component.state().name).toBe("ABC");

        changeInputValue(inputs[1], "XYZ");
        await nextProcessTick();
        expect(component.state().value).toBe("XYZ");

        const buttons = portals[0].getElementsByClassName("button");
        expect(buttons).toHaveLength(3);
        expect(buttons[1].id).toBe("ok");
        expect(buttons[2].id).toBe("cancel");

        (buttons[1] as HTMLButtonElement).click();
        expect(spyOnClose).toHaveBeenCalledTimes(1);
        expect(spyOnClose).toHaveBeenCalledWith(false, { name: "ABC", value: "XYZ" });
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });
});
