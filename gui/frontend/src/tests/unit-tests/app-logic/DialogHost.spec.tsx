/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { DialogHost } from "./../../../app-logic/DialogHost.js";
import { JestReactWrapper, nextProcessTick, sendKeyPress } from "../test-helpers.js";
import { DialogType, IDialogRequest } from "../../../app-logic/general-types.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

describe("DialogHost Tests", () => {
    let host: JestReactWrapper;

    beforeAll(() => {
        host = mount<DialogHost>(<DialogHost />);
    });

    afterAll(() => {
        host.unmount();
    });

    it("Standard Rendering (snapshot)", () => {
        // The host itself has no properties, but implicit children (the different dialogs).
        expect(host.props().children).toEqual([]);
        expect(host).toMatchSnapshot();
    });

    it("Show Prompt Dialog (snapshot)", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const promptRequest: IDialogRequest = {
            type: DialogType.Prompt,
            id: "shellPromptDialog",
            values: {
                prompt: "Lorem ipsum dolor sit amet",
            },
            data: {
                requestId: "12345",
            },
        };

        await requisitions.execute("showDialog", promptRequest);
        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        // Try to show the dialog again -> should have no effect.
        await requisitions.execute("showDialog", promptRequest);
        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        sendKeyPress(KeyboardKeys.Escape);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

});
